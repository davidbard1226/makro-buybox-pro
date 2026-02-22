// bridge.js v2 — stable, self-healing, no context crash

(function() {
  'use strict';

  const STORAGE_KEY = 'makro_buybox_v2';
  let syncInterval = null;
  let announceInterval = null;
  let dead = false;

  // ── SAFE CHROME API WRAPPER ───────────────────────────────────────────────
  function isAlive() {
    try {
      // This throws if context is invalidated
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch(e) {
      return false;
    }
  }

  function safeChrome(fn) {
    if (dead) return;
    try {
      if (!isAlive()) { killIntervals(); return; }
      fn();
    } catch(e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        killIntervals();
        dead = true;
        console.warn('[BuyBox Bridge] Extension context gone — stopped polling.');
      }
    }
  }

  function killIntervals() {
    if (syncInterval)     { clearInterval(syncInterval);     syncInterval = null; }
    if (announceInterval) { clearInterval(announceInterval); announceInterval = null; }
  }

  // ── ANNOUNCE ──────────────────────────────────────────────────────────────
  function announce() {
    safeChrome(function() {
      window.postMessage({ type: 'MAKRO_EXTENSION_READY', extensionId: chrome.runtime.id }, '*');
    });
  }

  // ── SYNC chrome.storage → localStorage ───────────────────────────────────
  function syncToLocalStorage() {
    safeChrome(function() {
      chrome.storage.local.get(['buybox_products'], function(r) {
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
          const fsn    = p.fsn || '';     // comes from content.js pid= extraction
          const sku    = p.sku || '';

          const entry = {
            url:         url,
            fsn:         fsn,
            sku:         sku,
            title:       p.title || url,
            buybox_price: price,
            seller:      seller,
            status:      'unknown',
            lastChecked: p.timestamp || new Date().toISOString(),
            history:     []
          };

          if (idx >= 0) {
            const prev = existing[idx];
            entry.history = prev.history || [];
            // Only add history point if price actually changed
            const lastPrice = entry.history.length ? entry.history[entry.history.length-1].price : null;
            if (price > 0 && price !== lastPrice) {
              entry.history.push({ price, seller, status: 'unknown', ts: entry.lastChecked });
              if (entry.history.length > 30) entry.history.shift();
            }
            // Preserve FSN if we already have one and new one is empty
            if (!entry.fsn && prev.fsn) entry.fsn = prev.fsn;
            existing[idx] = Object.assign({}, prev, entry);
          } else {
            if (price > 0) {
              entry.history = [{ price, seller, status: 'unknown', ts: entry.lastChecked }];
            }
            existing.push(entry);
          }
        });

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
          localStorage.setItem('makro_last_scrape', new Date().toISOString());
        } catch(e) {}

        window.postMessage({ type: 'PRODUCTS_UPDATED', count: existing.length }, '*');
      });
    });
  }

  // ── HANDLE SCRAPER REQUESTS from dashboard ────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type) return;
    if (dead) return;

    if (ev.data.type === 'DASHBOARD_SCRAPE_URL') {
      const url = ev.data.url;
      const requestId = ev.data.requestId;
      safeChrome(function() {
        chrome.runtime.sendMessage({ action: 'scrape_url', url, requestId }, function(resp) {
          if (chrome.runtime.lastError || !resp) {
            window.postMessage({ type: 'SCRAPE_RESULT', requestId, success: false, error: (chrome.runtime.lastError||{}).message || 'No response' }, '*');
            return;
          }
          if (resp.data) {
            const d = resp.data;
            window.postMessage({
              type: 'SCRAPE_RESULT', requestId, success: true,
              result: {
                title: d.title || '', buybox_price: d.buyBoxPrice || 0,
                seller_name: d.buyBoxSeller || 'Unknown Seller',
                seller: d.buyBoxSeller || 'Unknown Seller',
                fsn: d.fsn || d.sku || '', url: d.url, success: true
              }
            }, '*');
            syncToLocalStorage();
          } else {
            window.postMessage({ type: 'SCRAPE_RESULT', requestId, success: false, error: 'No data' }, '*');
          }
        });
      });
    }

    if (ev.data.type === 'REQUEST_EXTENSION') announce();
  });

  // ── STORAGE CHANGE LISTENER ───────────────────────────────────────────────
  safeChrome(function() {
    chrome.storage.onChanged.addListener(function(changes) {
      if (changes.buybox_products) setTimeout(syncToLocalStorage, 300);
    });
  });

  // ── START INTERVALS ───────────────────────────────────────────────────────
  announce();
  syncToLocalStorage();
  announceInterval = setInterval(announce, 4000);
  syncInterval     = setInterval(syncToLocalStorage, 5000);

  console.log('[BuyBox Bridge v2] Active');
})();
