// background.js — Makro BuyBox Pro service worker
'use strict';

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(function() {
    chrome.storage.local.get(['bbp_active'], function() {});
  }, 20000);
}

function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  if (msg.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }

  if (msg.action === 'queue_scrape') {
    var urls = msg.urls || [];
    if (!urls.length) { sendResponse({ error: 'No URLs' }); return true; }
    var state = {
      queue: urls.slice(),
      total: urls.length,
      done: 0,
      active: true,
      winId: null,
      tabId: null,
      waiting: false,
      startedAt: Date.now()
    };
    chrome.storage.local.set({ bbp_queue_state: state }, function() {
      sendResponse({ started: true, total: urls.length });
      startKeepAlive();
      openNext(state);
    });
    return true;
  }

  if (msg.action === 'stop_queue') {
    stopKeepAlive();
    chrome.storage.local.get(['bbp_queue_state'], function(r) {
      var s = r.bbp_queue_state || {};
      if (s.winId) chrome.windows.remove(s.winId, function() {});
      chrome.storage.local.set({ bbp_queue_state: { active: false, queue: [], done: s.done || 0, total: s.total || 0 } });
    });
    sendResponse({ stopped: true });
    return true;
  }

  if (msg.action === 'get_queue_status') {
    chrome.storage.local.get(['bbp_queue_state'], function(r) {
      sendResponse(r.bbp_queue_state || { active: false, queue: [], done: 0, total: 0 });
    });
    return true;
  }

  if (msg.action === 'page_scraped') {
    chrome.storage.local.get(['bbp_queue_state'], function(r) {
      var s = r.bbp_queue_state;
      if (!s || !s.active) { sendResponse({ ok: true }); return; }
      s.done++;
      s.waiting = false;
      if (s.queue.length > 0) {
        var delay = 4000 + Math.floor(Math.random() * 5000);
        s.nextAt = Date.now() + delay;
        chrome.storage.local.set({ bbp_queue_state: s }, function() {
          setTimeout(function() { loadNext(); }, delay);
        });
      } else {
        s.active = false;
        chrome.storage.local.set({ bbp_queue_state: s }, function() {
          stopKeepAlive();
          if (s.winId) setTimeout(function() { chrome.windows.remove(s.winId, function() {}); }, 2500);
        });
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});

function openNext(state) {
  if (!state.active || !state.queue.length) return;
  var url = state.queue.shift();
  state.waiting = true;
  chrome.windows.create({ url: url, type: 'normal', width: 1280, height: 900, left: 80, top: 40, focused: true }, function(win) {
    if (chrome.runtime.lastError || !win) return;
    state.winId = win.id;
    state.tabId = win.tabs[0].id;
    chrome.storage.local.set({ bbp_queue_state: state });
    safetyTimeout(state.tabId);
  });
}

function loadNext() {
  chrome.storage.local.get(['bbp_queue_state'], function(r) {
    var s = r.bbp_queue_state;
    if (!s || !s.active || !s.queue.length) return;
    var url = s.queue.shift();
    s.waiting = true;
    if (s.tabId) {
      chrome.tabs.get(s.tabId, function(tab) {
        if (chrome.runtime.lastError || !tab) {
          chrome.storage.local.set({ bbp_queue_state: s }, function() { openNext(s); });
          return;
        }
        chrome.tabs.update(s.tabId, { url: url, active: true }, function() {
          chrome.storage.local.set({ bbp_queue_state: s });
        });
        safetyTimeout(s.tabId);
      });
    } else {
      chrome.storage.local.set({ bbp_queue_state: s }, function() { openNext(s); });
    }
  });
}

function safetyTimeout(tabId) {
  setTimeout(function() {
    chrome.storage.local.get(['bbp_queue_state'], function(r) {
      var s = r.bbp_queue_state;
      if (!s || !s.active || !s.waiting || s.tabId !== tabId) return;
      s.done++;
      s.waiting = false;
      if (s.queue.length > 0) {
        s.nextAt = Date.now() + 4000;
        chrome.storage.local.set({ bbp_queue_state: s }, function() {
          setTimeout(function() { loadNext(); }, 4000);
        });
      } else {
        s.active = false;
        chrome.storage.local.set({ bbp_queue_state: s });
        stopKeepAlive();
      }
    });
  }, 15000);
}

chrome.windows.onRemoved.addListener(function(winId) {
  chrome.storage.local.get(['bbp_queue_state'], function(r) {
    var s = r.bbp_queue_state;
    if (s && s.winId === winId && s.active) {
      s.active = false;
      s.queue = [];
      s.aborted = true;
      chrome.storage.local.set({ bbp_queue_state: s });
      stopKeepAlive();
    }
  });
});
