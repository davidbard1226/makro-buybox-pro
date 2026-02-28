// background.js v4 — no background tab scraping (triggers bot detection)
// Instead: manages a queue of URLs to open as foreground tabs

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

// ── QUEUE STATE ───────────────────────────────────────────────────────────
let scrapeQueue  = [];
let scrapeActive = false;
let currentTab   = null;

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  // Dashboard sends this to start a human-mode queue scrape
  if (msg.action === 'queue_scrape') {
    scrapeQueue  = msg.urls || [];
    scrapeActive = true;
    sendResponse({ started: true, total: scrapeQueue.length });
    openNextInQueue();
    return true;
  }

  if (msg.action === 'stop_queue') {
    scrapeQueue  = [];
    scrapeActive = false;
    sendResponse({ stopped: true });
    return true;
  }

  if (msg.action === 'queue_status') {
    sendResponse({ active: scrapeActive, remaining: scrapeQueue.length });
    return true;
  }

  // content.js tells us it finished scraping a product page
  if (msg.action === 'page_scraped') {
    // Notify dashboard
    chrome.tabs.query({ url: 'https://davidbard1226.github.io/makro-buybox-pro/*' }, function(tabs) {
      tabs.forEach(function(t) {
        chrome.tabs.sendMessage(t.id, { action: 'scrape_done', data: msg.data }).catch(function(){});
      });
    });
    // Move to next after a natural delay
    if (scrapeActive && scrapeQueue.length > 0) {
      setTimeout(openNextInQueue, 1200);
    } else {
      scrapeActive = false;
      // Notify dashboard queue finished
      chrome.tabs.query({ url: 'https://davidbard1226.github.io/makro-buybox-pro/*' }, function(tabs) {
        tabs.forEach(function(t) {
          chrome.tabs.sendMessage(t.id, { action: 'queue_finished' }).catch(function(){});
        });
      });
    }
    sendResponse({ ok: true });
    return true;
  }
});

function openNextInQueue() {
  if (!scrapeActive || scrapeQueue.length === 0) return;
  const url = scrapeQueue.shift();

  if (currentTab) {
    // Reuse the same tab — navigate it to next URL
    chrome.tabs.update(currentTab, { url: url, active: true }, function(tab) {
      if (chrome.runtime.lastError || !tab) {
        // Tab was closed — open a new one
        chrome.tabs.create({ url: url, active: true }, function(t) { currentTab = t.id; });
      }
    });
  } else {
    chrome.tabs.create({ url: url, active: true }, function(t) { currentTab = t.id; });
  }
}

// Clean up if the scrape tab gets closed manually
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === currentTab) {
    currentTab = null;
    scrapeActive = false;
    scrapeQueue = [];
  }
});
