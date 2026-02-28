// background.js v6
// - Separate Chrome window for scraping (isolated, bot-free)
// - Portal upload automation support

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

// ── STATE ─────────────────────────────────────────────────────────────────
let queue        = [];
let active       = false;
let scrapeWinId  = null;   // the dedicated scrape window
let scrapeTabId  = null;   // the tab inside it
let totalUrls    = 0;
let doneCount    = 0;
let waitingForLoad = false;

// ── HUMAN-LIKE DELAY: 4-9 seconds ────────────────────────────────────────
function humanDelay() {
  return 4000 + Math.floor(Math.random() * 5000);
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  if (msg.action === 'queue_scrape') {
    if (active) { sendResponse({ error: 'Already running' }); return true; }
    queue       = [...(msg.urls || [])];
    totalUrls   = queue.length;
    doneCount   = 0;
    active      = true;
    scrapeWinId = null;
    scrapeTabId = null;
    sendResponse({ started: true, total: totalUrls });
    openScrapeWindow();
    return true;
  }

  if (msg.action === 'stop_queue') {
    active = false;
    queue  = [];
    if (scrapeWinId) {
      chrome.windows.remove(scrapeWinId, function() {});
      scrapeWinId = null;
      scrapeTabId = null;
    }
    sendResponse({ stopped: true });
    return true;
  }

  if (msg.action === 'queue_status') {
    sendResponse({ active, remaining: queue.length, done: doneCount, total: totalUrls });
    return true;
  }

  if (msg.action === 'page_scraped') {
    if (!active) { sendResponse({ ok: true }); return true; }
    doneCount++;
    waitingForLoad = false;
    notifyDashboard({ action: 'scrape_done', data: msg.data, done: doneCount, total: totalUrls });
    sendResponse({ ok: true });

    if (active && queue.length > 0) {
      setTimeout(loadNextUrl, humanDelay());
    } else {
      active = false;
      setTimeout(function() {
        notifyDashboard({ action: 'queue_finished', done: doneCount, total: totalUrls });
        // Close scrape window after short delay
        setTimeout(function() {
          if (scrapeWinId) chrome.windows.remove(scrapeWinId, function() {});
          scrapeWinId = null; scrapeTabId = null;
        }, 2000);
      }, 1000);
    }
    return true;
  }

  // Portal automation: trigger file upload on seller portal
  if (msg.action === 'portal_upload_ready') {
    notifyDashboard({ action: 'portal_upload_ready' });
    sendResponse({ ok: true });
    return true;
  }
});

// ── OPEN DEDICATED SCRAPE WINDOW ──────────────────────────────────────────
function openScrapeWindow() {
  if (queue.length === 0) return;
  const firstUrl = queue.shift();

  chrome.windows.create({
    url: firstUrl,
    type: 'normal',
    width: 1280,
    height: 900,
    left: 100,
    top: 50,
    focused: true
  }, function(win) {
    scrapeWinId = win.id;
    scrapeTabId = win.tabs[0].id;
    waitingForLoad = true;
    // Safety timeout: if content.js doesn't respond in 12s, move on
    setTimeout(function() {
      if (waitingForLoad && active) {
        waitingForLoad = false;
        doneCount++;
        notifyDashboard({ action: 'scrape_done', data: null, done: doneCount, total: totalUrls });
        if (queue.length > 0) setTimeout(loadNextUrl, humanDelay());
        else { active = false; notifyDashboard({ action: 'queue_finished', done: doneCount, total: totalUrls }); }
      }
    }, 12000);
  });
}

// ── NAVIGATE SCRAPE TAB TO NEXT URL ──────────────────────────────────────
function loadNextUrl() {
  if (!active || queue.length === 0) return;
  const url = queue.shift();

  if (scrapeTabId) {
    chrome.tabs.get(scrapeTabId, function(tab) {
      if (chrome.runtime.lastError || !tab || tab.windowId !== scrapeWinId) {
        // Tab or window gone — open fresh window
        openScrapeWindow();
        return;
      }
      chrome.tabs.update(scrapeTabId, { url: url, active: true });
      waitingForLoad = true;
      // Safety timeout
      setTimeout(function() {
        if (waitingForLoad && active) {
          waitingForLoad = false;
          doneCount++;
          notifyDashboard({ action: 'scrape_done', data: null, done: doneCount, total: totalUrls });
          if (queue.length > 0) setTimeout(loadNextUrl, humanDelay());
          else { active = false; notifyDashboard({ action: 'queue_finished', done: doneCount, total: totalUrls }); }
        }
      }, 12000);
    });
  } else {
    openScrapeWindow();
  }
}

// ── NOTIFY DASHBOARD TABS ─────────────────────────────────────────────────
function notifyDashboard(msg) {
  chrome.tabs.query({ url: 'https://davidbard1226.github.io/makro-buybox-pro/*' }, function(tabs) {
    tabs.forEach(function(t) {
      chrome.tabs.sendMessage(t.id, msg, function() {
        if (chrome.runtime.lastError) {} // swallow
      });
    });
  });
}

// ── CLEAN UP if scrape window is closed manually ──────────────────────────
chrome.windows.onRemoved.addListener(function(winId) {
  if (winId === scrapeWinId) {
    scrapeWinId = null;
    scrapeTabId = null;
    if (active) {
      active = false;
      queue  = [];
      notifyDashboard({ action: 'queue_aborted', done: doneCount, total: totalUrls });
    }
  }
});
