// background.js v5 — human-mode queue with natural timing

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

let queue       = [];
let active      = false;
let currentTab  = null;
let totalUrls   = 0;
let doneCount   = 0;

// Natural human-like delay: 3-8 seconds between pages
function humanDelay() {
  return 3000 + Math.floor(Math.random() * 5000);
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  if (msg.action === 'queue_scrape') {
    queue      = [...(msg.urls || [])];
    totalUrls  = queue.length;
    doneCount  = 0;
    active     = true;
    currentTab = null;
    sendResponse({ started: true, total: totalUrls });
    setTimeout(openNext, 800);
    return true;
  }

  if (msg.action === 'stop_queue') {
    queue  = [];
    active = false;
    if (currentTab) {
      try { chrome.tabs.remove(currentTab); } catch(e) {}
      currentTab = null;
    }
    sendResponse({ stopped: true });
    return true;
  }

  if (msg.action === 'queue_status') {
    sendResponse({ active, remaining: queue.length, done: doneCount, total: totalUrls });
    return true;
  }

  if (msg.action === 'page_scraped') {
    doneCount++;
    // Broadcast progress to all dashboard tabs
    notifyDashboard({ action: 'scrape_done', data: msg.data, done: doneCount, total: totalUrls });
    sendResponse({ ok: true });

    if (active && queue.length > 0) {
      setTimeout(openNext, humanDelay());
    } else {
      active = false;
      setTimeout(function() {
        notifyDashboard({ action: 'queue_finished', done: doneCount, total: totalUrls });
        // Close the scrape tab when done
        if (currentTab) {
          try { chrome.tabs.remove(currentTab); } catch(e) {}
          currentTab = null;
        }
      }, 1500);
    }
    return true;
  }
});

function openNext() {
  if (!active || queue.length === 0) return;
  const url = queue.shift();

  if (currentTab) {
    chrome.tabs.get(currentTab, function(tab) {
      if (chrome.runtime.lastError || !tab) {
        // Tab was closed by user — open fresh
        chrome.tabs.create({ url: url, active: true }, function(t) { currentTab = t.id; });
      } else {
        // Reuse same tab — navigate to next URL
        chrome.tabs.update(currentTab, { url: url, active: true });
      }
    });
  } else {
    chrome.tabs.create({ url: url, active: true }, function(t) { currentTab = t.id; });
  }
}

function notifyDashboard(msg) {
  chrome.tabs.query({ url: 'https://davidbard1226.github.io/makro-buybox-pro/*' }, function(tabs) {
    tabs.forEach(function(t) {
      chrome.tabs.sendMessage(t.id, msg, function() {
        // Swallow errors if dashboard tab is not listening
        if (chrome.runtime.lastError) {}
      });
    });
  });
}

// If user closes the scrape tab manually, stop the queue
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === currentTab) {
    currentTab = null;
    if (active) {
      active = false;
      queue  = [];
      notifyDashboard({ action: 'queue_aborted', done: doneCount, total: totalUrls });
    }
  }
});
