// bridge.js v3 — stable context handling

(function() {
  'use strict';

  const STORAGE_KEY = 'makro_buybox_v2';
  let syncInterval = null;
  let announceInterval = null;
  let dead = false;

  // ── CONTEXT CHECK ─────────────────────────────────────────────────────────
  function isAlive() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch(e) {
      return false;
    }
  }

  function killIntervals() {
    try { clearInterval(syncInterval); } catch(e) {}
    try { clearInterval(announceInterval); } catch(e) {}
    syncInterval = null;
    announceInterval = null;
    dead = true;
  }

  // Wraps any chrome API call — if context is gone, silently stops everything
  function safe(fn) {
    if (dead) return;
    if (!isAlive()) { killIntervals(); return; }
    try {
      fn();
    } catch(e) {
      if (/context invalidated|extension context/i.test(e.message || '')) {
        killIntervals();
        console.warn('[BuyBox Bridge] Extension unloaded — bridge stopped.');
      } else {
        console.warn('[BuyBox Bridge] Error:', e.message);
      }
    }
  }

  // ── ANNOUNCE ──────────────────────────────────────────────────────────────
  function announce() {
    safe(function() {
      window.postMessage({ type: 'MAKRO_EXTENSION_READY', extensionId: chrome.runtime.id }, '*');
    });
  }

  // ── SYNC chrome.storage → dashboard localStorage ──────────────────────────
  function syncToLocalStorage() {
    safe(function() {
      chrome.storage.local.get(['buybox_products'], function(r) {
        try {
          if (chrome.runtime.lastError) return;
          const raw = r.buybox_products || [];
          if (raw.length === 0) return;

          let existing = [];
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) existing = JSON.parse(saved);
          } catch(e) {}

          raw.forEach(function(p) {
            const url = p.url;
            const idx = existing.findIndex(function(e) { return e.url === url; });
            const seller = p.buyBoxSeller || 'Unknown Seller';
            const price  = parseFloat(p.buyBoxPrice) || 0;
            const fsn    = p.fsn || '';
            const sku    = p.sku || '';

            const entry = {
              url, fsn, sku,
              title:        p.title || url,
              buybox_price: price,
              seller:       seller,
              status:       'unknown',
              lastChecked:  p.timestamp || new Date().toISOString(),
              history:      []
            };

            if (idx >= 0) {
              const prev = existing[idx];
              entry.history = prev.history || [];
              const lastPrice = entry.history.length ? entry.history[entry.history.length-1].price : null;
              if (price > 0 && price !== lastPrice) {
                entry.history.push({ price, seller, status: 'unknown', ts: entry.lastChecked });
                if (entry.history.length > 30) entry.history.shift();
              }
              if (!entry.fsn && prev.fsn) entry.fsn = prev.fsn;
              existing[idx] = Object.assign({}, prev, entry);
            } else {
              if (price > 0) entry.history = [{ price, seller, status: 'unknown', ts: entry.lastChecked }];
              existing.push(entry);
            }
          });

          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
          localStorage.setItem('makro_last_scrape', new Date().toISOString());
          window.postMessage({ type: 'PRODUCTS_UPDATED', count: existing.length }, '*');
        } catch(e) {}
      });
    });
  }

  // ── MESSAGE HANDLER ───────────────────────────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type || dead) return;

    if (ev.data.type === 'START_QUEUE') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'queue_scrape', urls: ev.data.urls }, function(resp) {
          if (chrome.runtime.lastError) return;
          console.log('[Bridge] Queue started:', resp);
        });
      });
    }

    if (ev.data.type === 'STOP_QUEUE') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'stop_queue' }, function(){});
      });
    }

    if (ev.data.type === 'REQUEST_EXTENSION') announce();
  });

  // Forward scrape_done and queue_finished from background → dashboard
  safe(function() {
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.action === 'scrape_done') {
        window.postMessage({ type: 'QUEUE_PROGRESS', data: msg.data }, '*');
      }
      if (msg.action === 'queue_finished') {
        window.postMessage({ type: 'QUEUE_FINISHED' }, '*');
      }
    });
  });

  // ── STORAGE CHANGE LISTENER ───────────────────────────────────────────────
  safe(function() {
    chrome.storage.onChanged.addListener(function(changes) {
      if (changes.buybox_products) setTimeout(syncToLocalStorage, 300);
    });
  });

  // ── START ─────────────────────────────────────────────────────────────────
  announce();
  syncToLocalStorage();
  announceInterval = setInterval(announce, 4000);
  syncInterval     = setInterval(syncToLocalStorage, 5000);

  console.log('[BuyBox Bridge v3] Active');
})();
