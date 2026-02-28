// background.js v7 — parallel tab scraping (up to 3 concurrent tabs)

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

// ── STATE ─────────────────────────────────────────────────────────────────
let queue        = [];
let active       = false;
let totalUrls    = 0;
let doneCount    = 0;
let concurrency  = 1;      // max parallel tabs (1–3)
let scrapeWinId  = null;   // one shared window all tabs live in
// activeTabs: Map<tabId, { url, timeoutId, waitingForLoad }>
let activeTabs   = new Map();

// ── HUMAN-LIKE DELAY: 4-9 seconds per slot ───────────────────────────────
function humanDelay() {
  return 4000 + Math.floor(Math.random() * 5000);
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  // ── START QUEUE ──────────────────────────────────────────────────────────
  if (msg.action === 'queue_scrape') {
    if (active) { sendResponse({ error: 'Already running' }); return true; }
    queue        = [...(msg.urls || [])];
    totalUrls    = queue.length;
    doneCount    = 0;
    concurrency  = Math.min(Math.max(parseInt(msg.concurrency) || 1, 1), 3);
    active       = true;
    scrapeWinId  = null;
    activeTabs.clear();
    sendResponse({ started: true, total: totalUrls });
    openScrapeWindow();
    return true;
  }

  // ── STOP QUEUE ───────────────────────────────────────────────────────────
  if (msg.action === 'stop_queue') {
    shutdownAll();
    sendResponse({ stopped: true });
    return true;
  }

  // ── STATUS ───────────────────────────────────────────────────────────────
  if (msg.action === 'queue_status') {
    sendResponse({ active, remaining: queue.length, done: doneCount, total: totalUrls });
    return true;
  }

  // ── PAGE SCRAPED (from content.js) ───────────────────────────────────────
  if (msg.action === 'page_scraped') {
    if (!active) { sendResponse({ ok: true }); return true; }
    const tabId = sender.tab && sender.tab.id;
    const slot = tabId ? activeTabs.get(tabId) : null;
    if (slot && slot.timeoutId) clearTimeout(slot.timeoutId);
    if (tabId) activeTabs.delete(tabId);

    doneCount++;
    notifyDashboard({ action: 'scrape_done', data: msg.data, done: doneCount, total: totalUrls });
    sendResponse({ ok: true });

    // Slight stagger so tabs don't fire simultaneously
    const delay = humanDelay() + (activeTabs.size * 1200);
    if (active && queue.length > 0) {
      setTimeout(function() { loadNextUrlInTab(tabId); }, delay);
    } else if (active && queue.length === 0 && activeTabs.size === 0) {
      finishQueue();
    }
    return true;
  }

  // ── PORTAL UPLOAD ─────────────────────────────────────────────────────────
  if (msg.action === 'portal_upload_ready') {
    notifyDashboard({ action: 'portal_upload_ready' });
    sendResponse({ ok: true });
    return true;
  }
});

// ── OPEN SCRAPE WINDOW WITH FIRST BATCH OF TABS ──────────────────────────
function openScrapeWindow() {
  if (queue.length === 0) return;
  const firstUrl = queue.shift();

  chrome.windows.create({
    url: firstUrl,
    type: 'normal',
    width: 1280,
    height: 900,
    left: 50,
    top: 50,
    focused: true
  }, function(win) {
    scrapeWinId = win.id;
    const tabId = win.tabs[0].id;
    registerTab(tabId, firstUrl);

    // Open remaining parallel slots with staggered delays
    for (let i = 1; i < concurrency; i++) {
      if (queue.length === 0) break;
      const url = queue.shift();
      const delay = i * 1500;   // stagger by 1.5s per slot
      setTimeout(function() {
        if (!active || !scrapeWinId) return;
        chrome.tabs.create({ windowId: scrapeWinId, url: url, active: false }, function(tab) {
          if (tab) registerTab(tab.id, url);
        });
      }, delay);
    }
  });
}

// ── REGISTER A TAB AND SET SAFETY TIMEOUT ────────────────────────────────
function registerTab(tabId, url) {
  const timeoutId = setTimeout(function() {
    // Safety: if no response in 15s, skip this URL and move on
    if (activeTabs.has(tabId)) {
      activeTabs.delete(tabId);
      doneCount++;
      notifyDashboard({ action: 'scrape_done', data: null, done: doneCount, total: totalUrls });
      if (active && queue.length > 0) {
        setTimeout(function() { loadNextUrlInTab(tabId); }, humanDelay());
      } else if (active && queue.length === 0 && activeTabs.size === 0) {
        finishQueue();
      }
    }
  }, 15000);

  activeTabs.set(tabId, { url, timeoutId });
}

// ── NAVIGATE AN EXISTING TAB TO NEXT URL ─────────────────────────────────
function loadNextUrlInTab(tabId) {
  if (!active || queue.length === 0) {
    if (activeTabs.size === 0) finishQueue();
    return;
  }
  const url = queue.shift();

  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError || !tab || tab.windowId !== scrapeWinId) {
      // Tab gone — open a new one in the window
      if (scrapeWinId) {
        chrome.tabs.create({ windowId: scrapeWinId, url: url, active: false }, function(newTab) {
          if (newTab) registerTab(newTab.id, url);
        });
      } else {
        // Window also gone — put URL back and open fresh window
        queue.unshift(url);
        openScrapeWindow();
      }
      return;
    }
    chrome.tabs.update(tabId, { url: url });
    registerTab(tabId, url);
  });
}

// ── FINISH QUEUE ─────────────────────────────────────────────────────────
function finishQueue() {
  active = false;
  setTimeout(function() {
    notifyDashboard({ action: 'queue_finished', done: doneCount, total: totalUrls });
    setTimeout(function() {
      if (scrapeWinId) chrome.windows.remove(scrapeWinId, function() {});
      scrapeWinId = null;
      activeTabs.clear();
    }, 2000);
  }, 500);
}

// ── SHUTDOWN EVERYTHING ───────────────────────────────────────────────────
function shutdownAll() {
  active = false;
  queue  = [];
  activeTabs.forEach(function(slot) { clearTimeout(slot.timeoutId); });
  activeTabs.clear();
  if (scrapeWinId) {
    chrome.windows.remove(scrapeWinId, function() {});
    scrapeWinId = null;
  }
}

// ── NOTIFY DASHBOARD TABS ─────────────────────────────────────────────────
function notifyDashboard(msg) {
  chrome.tabs.query({ url: 'https://davidbard1226.github.io/makro-buybox-pro/*' }, function(tabs) {
    tabs.forEach(function(t) {
      chrome.tabs.sendMessage(t.id, msg, function() {
        if (chrome.runtime.lastError) {}
      });
    });
  });
}

// ── CLEAN UP if scrape window closed manually ─────────────────────────────
chrome.windows.onRemoved.addListener(function(winId) {
  if (winId === scrapeWinId) {
    scrapeWinId = null;
    activeTabs.clear();
    if (active) {
      active = false;
      queue  = [];
      notifyDashboard({ action: 'queue_aborted', done: doneCount, total: totalUrls });
    }
  }
});
