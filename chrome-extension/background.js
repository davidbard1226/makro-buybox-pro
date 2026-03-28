// background.js v9 — up to 5 concurrent tabs, bot-challenge detection

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
let concurrency  = 1;
let scrapeWinId  = null;
let activeTabs   = new Map();

// ── CATALOGUE SEARCH STATE ────────────────────────────────────────────────
let catSearchMode    = false;
let catSearchQueue   = [];   // [{sku, query}]
let catSearchTotal   = 0;
let catSearchDone    = 0;
let catSearchResults = {};   // {sku: {url, title}}

// ── HUMAN-LIKE DELAY: 3-8 seconds per slot ───────────────────────────────
function humanDelay() {
  // Wider random range: 3-8s — harder to fingerprint as a bot
  return 3000 + Math.floor(Math.random() * 5000);
}

// ── CHALLENGE DETECTION ──────────────────────────────────────────────────
// Called when a tab navigates to a non-product URL (challenge/redirect page)
let challengePaused = false;
let challengeTabId  = null;

function isChallengeUrl(url) {
  if (!url) return false;
  return /challenges\.cloudflare\.com|cdn-cgi|interstitial|are-you-human|verify.*human|robot.*check|captcha/i.test(url);
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  // ── CATALOGUE SEARCH: START ──────────────────────────────────────────────
  if (msg.action === 'cat_search_start') {
    if (active) { sendResponse({ error: 'Scraper already running — stop it first' }); return true; }
    catSearchQueue   = [...(msg.items || [])];  // [{sku, query}]
    catSearchTotal   = catSearchQueue.length;
    catSearchDone    = 0;
    catSearchResults = {};
    concurrency      = Math.min(Math.max(parseInt(msg.concurrency) || 2, 1), 3);
    active           = true;
    scrapeWinId      = null;
    activeTabs.clear();
    catSearchMode    = true;
    sendResponse({ started: true, total: catSearchTotal });
    openCatSearchWindow();
    return true;
  }

  // ── CATALOGUE SEARCH: RESULT FROM search_content.js ──────────────────────
  if (msg.action === 'search_scraped') {
    if (!active || !catSearchMode) { sendResponse({ ok: true }); return true; }
    const tabId = sender.tab && sender.tab.id;
    const slot  = tabId ? activeTabs.get(tabId) : null;
    if (slot && slot.timeoutId) clearTimeout(slot.timeoutId);
    if (tabId) activeTabs.delete(tabId);

    const d = msg.data || {};
    if (d.foundUrl && slot && slot.sku) {
      catSearchResults[slot.sku] = { url: d.foundUrl, title: d.foundTitle, sku: slot.sku };
    }
    catSearchDone++;

    // Persist results to storage every 10 finds
    if (catSearchDone % 10 === 0) {
      chrome.storage.local.set({ cat_search_results: catSearchResults });
    }

    notifyDashboard({
      action:   'cat_search_progress',
      done:     catSearchDone,
      total:    catSearchTotal,
      found:    Object.keys(catSearchResults).length,
      lastSku:  slot ? slot.sku : '',
      lastUrl:  d.foundUrl || ''
    });

    if (challengePaused) { sendResponse({ ok: true }); return true; }

    const delay = humanDelay() + (activeTabs.size * 1200);
    if (active && catSearchQueue.length > 0) {
      setTimeout(function() { loadNextSearchInTab(tabId); }, delay);
    } else if (active && catSearchQueue.length === 0 && activeTabs.size === 0) {
      finishCatSearch();
    }
    sendResponse({ ok: true });
    return true;
  }

  // ── CATALOGUE SEARCH: STOP ────────────────────────────────────────────────
  if (msg.action === 'cat_search_stop') {
    chrome.storage.local.set({ cat_search_results: catSearchResults });
    shutdownAll();
    catSearchMode = false;
    sendResponse({ stopped: true, found: Object.keys(catSearchResults).length });
    return true;
  }

  // ── CATALOGUE SEARCH: GET RESULTS ─────────────────────────────────────────
  if (msg.action === 'cat_search_get_results') {
    chrome.storage.local.get(['cat_search_results'], function(r) {
      sendResponse({ results: r.cat_search_results || catSearchResults });
    });
    return true;
  }

  // ── CATALOGUE SEARCH: STATUS ──────────────────────────────────────────────
  if (msg.action === 'cat_search_status') {
    sendResponse({
      active: active && catSearchMode,
      done: catSearchDone,
      total: catSearchTotal,
      found: Object.keys(catSearchResults).length,
      remaining: catSearchQueue.length
    });
    return true;
  }

  // ── START QUEUE ──────────────────────────────────────────────────────────
  if (msg.action === 'queue_scrape') {
    if (active) { sendResponse({ error: 'Already running' }); return true; }
    queue        = [...(msg.urls || [])];
    totalUrls    = queue.length;
    doneCount    = 0;
    concurrency  = Math.min(Math.max(parseInt(msg.concurrency) || 1, 1), 5);
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

  // ── RESUME AFTER CHALLENGE SOLVED ───────────────────────────────────────
  if (msg.action === 'resume_after_challenge') {
    challengePaused = false;
    challengeTabId  = null;
    sendResponse({ resumed: true });
    // Restart queue processing
    if (active && queue.length > 0) {
      setTimeout(function() { loadNextUrlInTab(null); }, humanDelay());
    }
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
    // If queue was paused for a challenge, don't advance until resumed
    if (challengePaused) { return; }
    const delay = humanDelay() + (activeTabs.size * 1500);
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
      const delay = i * 800;   // stagger by 0.8s per slot
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

  // Watch for challenge pages on this tab
  chrome.tabs.onUpdated.addListener(function onUpdated(tId, info) {
    if (tId !== tabId) return;
    if (info.url && isChallengeUrl(info.url)) {
      // CHALLENGE DETECTED — pause queue and alert dashboard
      challengePaused = true;
      challengeTabId  = tabId;
      clearTimeout(activeTabs.get(tabId) && activeTabs.get(tabId).timeoutId);
      notifyDashboard({ action: 'challenge_detected', tabId: tabId, url: info.url });
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
    if (info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
  });
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

// ── CAT SEARCH: OPEN FIRST WINDOW ────────────────────────────────────────
function openCatSearchWindow() {
  if (catSearchQueue.length === 0) return;
  const item   = catSearchQueue.shift();
  const searchUrl = 'https://www.makro.co.za/search?q=' + encodeURIComponent(item.query);

  chrome.windows.create({
    url: searchUrl, type: 'normal',
    width: 1280, height: 900, left: 50, top: 50, focused: true
  }, function(win) {
    scrapeWinId = win.id;
    const tabId = win.tabs[0].id;
    registerSearchTab(tabId, item);

    for (let i = 1; i < concurrency; i++) {
      if (catSearchQueue.length === 0) break;
      const next = catSearchQueue.shift();
      const delay = i * 900;
      setTimeout(function() {
        if (!active || !scrapeWinId) return;
        chrome.tabs.create({
          windowId: scrapeWinId,
          url: 'https://www.makro.co.za/search?q=' + encodeURIComponent(next.query),
          active: false
        }, function(tab) {
          if (tab) registerSearchTab(tab.id, next);
        });
      }, delay);
    }
  });
}

// ── CAT SEARCH: REGISTER TAB ──────────────────────────────────────────────
function registerSearchTab(tabId, item) {
  const timeoutId = setTimeout(function() {
    if (activeTabs.has(tabId)) {
      activeTabs.delete(tabId);
      catSearchDone++;
      notifyDashboard({ action: 'cat_search_progress', done: catSearchDone, total: catSearchTotal, found: Object.keys(catSearchResults).length, lastSku: item.sku, lastUrl: '' });
      if (active && catSearchQueue.length > 0) {
        setTimeout(function() { loadNextSearchInTab(tabId); }, humanDelay());
      } else if (active && catSearchQueue.length === 0 && activeTabs.size === 0) {
        finishCatSearch();
      }
    }
  }, 20000);  // 20s timeout — enough for slow Makro pages + 6s retry in search_content.js

  activeTabs.set(tabId, { url: 'https://www.makro.co.za/search?q=' + encodeURIComponent(item.query), sku: item.sku, query: item.query, timeoutId });

  // Watch for challenge pages
  chrome.tabs.onUpdated.addListener(function onUpdated(tId, info) {
    if (tId !== tabId) return;
    if (info.url && isChallengeUrl(info.url)) {
      challengePaused = true;
      challengeTabId  = tabId;
      const slot = activeTabs.get(tabId);
      if (slot) clearTimeout(slot.timeoutId);
      notifyDashboard({ action: 'challenge_detected', tabId: tabId, url: info.url });
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
    if (info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
  });
}

// ── CAT SEARCH: LOAD NEXT ─────────────────────────────────────────────────
function loadNextSearchInTab(tabId) {
  if (!active || catSearchQueue.length === 0) {
    if (activeTabs.size === 0) finishCatSearch();
    return;
  }
  const item = catSearchQueue.shift();
  const url  = 'https://www.makro.co.za/search?q=' + encodeURIComponent(item.query);

  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError || !tab || tab.windowId !== scrapeWinId) {
      if (scrapeWinId) {
        chrome.tabs.create({ windowId: scrapeWinId, url: url, active: false }, function(t) {
          if (t) registerSearchTab(t.id, item);
        });
      } else {
        catSearchQueue.unshift(item);
        openCatSearchWindow();
      }
      return;
    }
    chrome.tabs.update(tabId, { url: url });
    registerSearchTab(tabId, item);
  });
}

// ── CAT SEARCH: FINISH ────────────────────────────────────────────────────
function finishCatSearch() {
  active        = false;
  catSearchMode = false;
  chrome.storage.local.set({ cat_search_results: catSearchResults });
  setTimeout(function() {
    notifyDashboard({
      action: 'cat_search_finished',
      done:   catSearchDone,
      total:  catSearchTotal,
      found:  Object.keys(catSearchResults).length
    });
    setTimeout(function() {
      if (scrapeWinId) chrome.windows.remove(scrapeWinId, function() {});
      scrapeWinId = null;
      activeTabs.clear();
    }, 2000);
  }, 500);
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
  active        = false;
  catSearchMode = false;
  queue         = [];
  catSearchQueue = [];
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
