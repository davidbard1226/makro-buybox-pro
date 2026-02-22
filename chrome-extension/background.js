// background.js v7 — reliable service worker queue
// Stores all state in chrome.storage.session so it survives SW sleep cycles

const STATE_KEY = 'bbp_queue_state';

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

// ── KEEP SERVICE WORKER ALIVE during active scrape ────────────────────────
let keepAliveInterval = null;
function keepAlive() {
  keepAliveInterval = setInterval(function() {
    chrome.storage.local.get(['bbp_active'], function() {}); // just poke storage
  }, 20000);
}
function stopKeepAlive() {
  if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  if (msg.action === 'queue_scrape') {
    const urls = msg.urls || [];
    if (!urls.length) { sendResponse({ error: 'No URLs' }); return true; }

    // Save queue state to storage (survives SW sleep)
    const state = {
      queue:      urls,
      total:      urls.length,
      done:       0,
      active:     true,
      winId:      null,
      tabId:      null,
      waiting:    false,
      startedAt:  Date.now()
    };
    chrome.storage.local.set({ bbp_queue_state: state }, function() {
      sendResponse({ started: true, total: urls.length });
      keepAlive();
      openNext(state);
    });
    return true;
  }

  if (msg.action === 'stop_queue') {
    stopKeepAlive();
    chrome.storage.local.get(['bbp_queue_state'], function(r) {
      const s = r.bbp_queue_state || {};
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
      const s = r.bbp_queue_state;
      if (!s || !s.active) { sendResponse({ ok: true }); return; }

      s.done++;
      s.waiting = false;

      if (s.queue.length > 0) {
        // Natural delay 4-9s then next
        const delay = 4000 + Math.floor(Math.random() * 5000);
        s.nextAt = Date.now() + delay;
        chrome.storage.local.set({ bbp_queue_state: s }, function() {
          setTimeout(function() { loadNext(s); }, delay);
        });
      } else {
        // Done!
        s.active = false;
        chrome.storage.local.set({ bbp_queue_state: s }, function() {
          stopKeepAlive();
          // Close scrape window
          if (s.winId) setTimeout(function() {
            chrome.windows.remove(s.winId, function() {});
          }, 2500);
        });
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});

function openNext(state) {
  if (!state.active || !state.queue.length) return;
  const url = state.queue.shift();
  state.waiting = true;

  chrome.windows.create({
    url:     url,
    type:    'normal',
    width:   1280,
    height:  900,
    left:    80,
    top:     40,
    focused: true
  }, function(win) {
    if (chrome.runtime.lastError || !win) {
      console.error('[BBP] Window create failed:', chrome.runtime.lastError);
      return;
    }
    state.winId = win.id;
    state.tabId = win.tabs[0].id;
    chrome.storage.local.set({ bbp_queue_state: state });

    // Safety timeout — if content.js never reports back in 15s, advance anyway
    setTimeout(function() {
      chrome.storage.local.get(['bbp_queue_state'], function(r) {
        const s = r.bbp_queue_state;
        if (s && s.active && s.waiting && s.tabId === state.tabId) {
          s.done++;
          s.waiting = false;
          if (s.queue.length > 0) {
            s.nextAt = Date.now() + 4000;
            chrome.storage.local.set({ bbp_queue_state: s }, function() {
              setTimeout(function() { loadNext(s); }, 4000);
            });
          } else {
            s.active = false;
            chrome.storage.local.set({ bbp_queue_state: s });
            stopKeepAlive();
          }
        }
      });
    }, 15000);
  });
}

function loadNext(state) {
  chrome.storage.local.get(['bbp_queue_state'], function(r) {
    const s = r.bbp_queue_state;
    if (!s || !s.active || !s.queue.length) return;

    const url = s.queue.shift();
    s.waiting = true;

    if (s.tabId) {
      chrome.tabs.get(s.tabId, function(tab) {
        if (chrome.runtime.lastError || !tab) {
          // Tab gone — open new window
          chrome.storage.local.set({ bbp_queue_state: s }, function() { openNext(s); });
          return;
        }
        chrome.tabs.update(s.tabId, { url: url, active: true }, function() {
          chrome.storage.local.set({ bbp_queue_state: s });
        });

        // Safety timeout
        setTimeout(function() {
          chrome.storage.local.get(['bbp_queue_state'], function(r2) {
            const s2 = r2.bbp_queue_state;
            if (s2 && s2.active && s2.waiting && s2.tabId === s.tabId) {
              s2.done++;
              s2.waiting = false;
              if (s2.queue.length > 0) {
                s2.nextAt = Date.now() + 4000;
                chrome.storage.local.set({ bbp_queue_state: s2 }, function() {
                  setTimeout(function() { loadNext(s2); }, 4000);
                });
              } else {
                s2.active = false;
                chrome.storage.local.set({ bbp_queue_state: s2 });
                stopKeepAlive();
              }
            }
          });
        }, 15000);
      });
    } else {
      chrome.storage.local.set({ bbp_queue_state: s }, function() { openNext(s); });
    }
  });
}

// Clean up if scrape window closed manually
chrome.windows.onRemoved.addListener(function(winId) {
  chrome.storage.local.get(['bbp_queue_state'], function(r) {
    const s = r.bbp_queue_state;
    if (s && s.winId === winId && s.active) {
      s.active  = false;
      s.queue   = [];
      s.aborted = true;
      chrome.storage.local.set({ bbp_queue_state: s });
      stopKeepAlive();
    }
  });
});
