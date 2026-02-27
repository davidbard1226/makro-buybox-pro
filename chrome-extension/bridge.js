// bridge.js v7 — no service worker needed, queue runs via tabs API from bridge
(function() {
  'use strict';

  const STORAGE_KEY = 'makro_buybox_v2';
  let dead = false;
  let failCount = 0;
  const FAIL_THRESHOLD = 20;
  let syncInterval = null;
  let announceInterval = null;
  let pollInterval = null;
  let lastDone = -1;
  let wasActive = false;
  let queueTabId = null;
  let queueUrls = [];
  let queueTotal = 0;
  let queueDone = 0;
  let queueActive = false;

  function isAlive() {
    try {
      var ok = !!(chrome && chrome.runtime && chrome.runtime.id);
      if (ok) { failCount = 0; return true; }
      failCount++;
      return false;
    } catch(e) { failCount++; return false; }
  }

  function killAll() {
    try { clearInterval(syncInterval); } catch(e) {}
    try { clearInterval(announceInterval); } catch(e) {}
    try { clearInterval(pollInterval); } catch(e) {}
    syncInterval = announceInterval = pollInterval = null;
    dead = true;
  }

  function safe(fn) {
    if (dead) return;
    if (!isAlive()) { if (failCount >= FAIL_THRESHOLD) killAll(); return; }
    try { fn(); } catch(e) {
      if (/context invalidated|extension context/i.test(e.message || '')) {
        failCount++;
        if (failCount >= FAIL_THRESHOLD) killAll();
      }
    }
  }

  function announce() {
    safe(function() {
      window.postMessage({ type: 'MAKRO_EXTENSION_READY', extensionId: chrome.runtime.id }, '*');
    });
  }

  function syncProducts() {
    safe(function() {
      chrome.storage.local.get(['buybox_products'], function(r) {
        if (chrome.runtime.lastError) return;
        var raw = r.buybox_products || [];
        if (!raw.length) return;
        var existing = [];
        try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) {}
        raw.forEach(function(p) {
          var url = p.url;
          var idx = existing.findIndex(function(e) { return e.url === url; });
          var seller = p.buyBoxSeller || 'Unknown Seller';
          var price = parseFloat(p.buyBoxPrice) || 0;
          var entry = {
            url: url,
            fsn: p.fsn || '',
            sku: (p.sku && !p.sku.startsWith('itm')) ? p.sku : '',
            title: p.title || url,
            buybox_price: price,
            seller: seller,
            status: 'unknown',
            lastChecked: p.timestamp || new Date().toISOString(),
            history: []
          };
          if (idx >= 0) {
            var prev = existing[idx];
            entry.history = prev.history || [];
            var lastPrice = entry.history.length ? entry.history[entry.history.length-1].price : null;
            if (price > 0 && price !== lastPrice) {
              entry.history.push({ price: price, seller: seller, status: 'unknown', ts: entry.lastChecked });
              if (entry.history.length > 30) entry.history.shift();
            }
            if (!entry.fsn && prev.fsn) entry.fsn = prev.fsn;
            if (!entry.sku && prev.sku && !prev.sku.startsWith('itm')) entry.sku = prev.sku;
            existing[idx] = Object.assign({}, prev, entry);
          } else {
            if (price > 0) entry.history = [{ price: price, seller: seller, status: 'unknown', ts: entry.lastChecked }];
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

  // ── QUEUE via chrome.tabs ────────────────────────────────────────────────
  function startQueue(urls) {
    if (!urls.length) return;
    queueUrls   = urls.slice();
    queueTotal  = urls.length;
    queueDone   = 0;
    queueActive = true;
    queueTabId  = null;
    openNextUrl();
  }

  function openNextUrl() {
    if (!queueActive || !queueUrls.length) {
      queueActive = false;
      window.postMessage({ type: 'QUEUE_FINISHED', done: queueDone, total: queueTotal }, '*');
      if (queueTabId) {
        safe(function() { chrome.tabs.remove(queueTabId, function() {}); });
        queueTabId = null;
      }
      return;
    }
    var url = queueUrls.shift();
    safe(function() {
      if (queueTabId) {
        chrome.tabs.update(queueTabId, { url: url, active: true }, function() {
          if (chrome.runtime.lastError) {
            // tab gone, create new
            queueTabId = null;
            chrome.tabs.create({ url: url, active: true }, function(tab) {
              queueTabId = tab.id;
              waitForScrape();
            });
          } else {
            waitForScrape();
          }
        });
      } else {
        chrome.tabs.create({ url: url, active: true }, function(tab) {
          queueTabId = tab.id;
          waitForScrape();
        });
      }
    });
  }

  function waitForScrape() {
    // Wait up to 18s for content.js to report back via storage change
    // Safety: advance after 18s regardless
    setTimeout(function() {
      if (!queueActive) return;
      queueDone++;
      window.postMessage({ type: 'QUEUE_PROGRESS', done: queueDone, total: queueTotal, data: null }, '*');
      syncProducts();
      var delay = 3000 + Math.floor(Math.random() * 3000);
      setTimeout(openNextUrl, delay);
    }, 18000);
  }

  function stopQueue() {
    queueActive = false;
    queueUrls   = [];
    if (queueTabId) {
      safe(function() { chrome.tabs.remove(queueTabId, function() {}); });
      queueTabId = null;
    }
    window.postMessage({ type: 'QUEUE_ABORTED', done: queueDone, total: queueTotal }, '*');
  }

  // ── STORAGE CHANGE — instant product sync ─────────────────────────────────
  safe(function() {
    chrome.storage.onChanged.addListener(function(changes) {
      if (changes.buybox_products) {
        setTimeout(function() {
          syncProducts();
          if (queueActive) {
            // Content script saved data — advance queue early
            queueDone++;
            window.postMessage({ type: 'QUEUE_PROGRESS', done: queueDone, total: queueTotal, data: null }, '*');
            var delay = 3000 + Math.floor(Math.random() * 3000);
            setTimeout(openNextUrl, delay);
          }
        }, 500);
      }
    });
  });

  // ── WINDOW MESSAGES ──────────────────────────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type || dead) return;
    if (ev.data.type === 'START_QUEUE')    { safe(function() { startQueue(ev.data.urls || []); }); }
    if (ev.data.type === 'STOP_QUEUE')     { safe(function() { stopQueue(); }); }
    if (ev.data.type === 'REQUEST_EXTENSION') announce();
    if (ev.data.type === 'SAVE_PORTAL_FILE') {
      safe(function() {
        chrome.storage.local.set({ portal_upload_file: ev.data.base64, portal_upload_filename: ev.data.filename });
      });
    }
  });

  announce();
  syncProducts();
  announceInterval = setInterval(announce,      4000);
  syncInterval     = setInterval(syncProducts,  6000);

  console.log('[BuyBox Bridge v7] Active — no service worker needed');
})();
