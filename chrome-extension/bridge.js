// bridge.js v8 — robust scraper queue, no safe() blocking on START_QUEUE
(function() {
  'use strict';

  const STORAGE_KEY = 'makro_buybox_v2';
  let dead = false;
  let syncInterval = null;
  let announceInterval = null;
  let queueTabId = null;
  let queueUrls = [];
  let queueTotal = 0;
  let queueDone = 0;
  let queueActive = false;

  function isAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch(e) { return false; }
  }

  function killAll() {
    clearInterval(syncInterval);
    clearInterval(announceInterval);
    syncInterval = announceInterval = null;
    dead = true;
    queueActive = false;
  }

  // safe() only used for background/storage ops — NOT for queue control
  function safe(fn) {
    if (dead) return;
    if (!isAlive()) return;
    try { fn(); } catch(e) {
      if (/context invalidated|extension context/i.test(e.message || '')) killAll();
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
            url: url, fsn: p.fsn || '',
            sku: (p.sku && !p.sku.startsWith('itm')) ? p.sku : '',
            title: p.title || url, buybox_price: price,
            seller: seller, status: 'unknown',
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

  // ── QUEUE ─────────────────────────────────────────────────────────────────
  function startQueue(urls) {
    if (!urls.length) { console.warn('[Bridge] startQueue called with 0 URLs'); return; }
    console.log('[Bridge] startQueue', urls.length, 'URLs');
    queueUrls   = urls.slice();
    queueTotal  = urls.length;
    queueDone   = 0;
    queueActive = true;
    queueTabId  = null;
    openNextUrl();
  }

  function openNextUrl() {
    console.log('[Bridge] openNextUrl — queue remaining:', queueUrls.length, 'active:', queueActive);
    if (!queueActive || !queueUrls.length) {
      queueActive = false;
      window.postMessage({ type: 'QUEUE_FINISHED', done: queueDone, total: queueTotal }, '*');
      if (queueTabId) {
        try { chrome.tabs.remove(queueTabId, function() {}); } catch(e) {}
        queueTabId = null;
      }
      return;
    }

    if (!isAlive()) {
      console.error('[Bridge] Extension context dead — cannot open tab');
      window.postMessage({ type: 'QUEUE_ABORTED', done: queueDone, total: queueTotal }, '*');
      return;
    }

    var url = queueUrls.shift();
    console.log('[Bridge] Opening tab for:', url.slice(0, 80));

    try {
      if (queueTabId) {
        chrome.tabs.get(queueTabId, function(tab) {
          if (chrome.runtime.lastError || !tab) {
            queueTabId = null;
            createNewTab(url);
          } else {
            chrome.tabs.update(queueTabId, { url: url, active: false }, function() {
              if (chrome.runtime.lastError) { queueTabId = null; createNewTab(url); return; }
              console.log('[Bridge] Tab updated:', queueTabId);
              safetyTimeout(queueTabId);
            });
          }
        });
      } else {
        createNewTab(url);
      }
    } catch(e) {
      console.error('[Bridge] tab error:', e);
      advanceQueue();
    }
  }

  function createNewTab(url) {
    try {
      chrome.tabs.create({ url: url, active: false }, function(tab) {
        if (chrome.runtime.lastError || !tab) {
          console.error('[Bridge] tabs.create failed:', chrome.runtime.lastError);
          advanceQueue();
          return;
        }
        console.log('[Bridge] Tab created id:', tab.id, url.slice(0,60));
        queueTabId = tab.id;
        safetyTimeout(tab.id);
      });
    } catch(e) {
      console.error('[Bridge] tabs.create threw:', e);
      advanceQueue();
    }
  }

  function advanceQueue() {
    if (!queueActive) return;
    queueDone++;
    window.postMessage({ type: 'QUEUE_PROGRESS', done: queueDone, total: queueTotal, data: null }, '*');
    syncProducts();
    var delay = 3000 + Math.floor(Math.random() * 3000);
    setTimeout(openNextUrl, delay);
  }

  function safetyTimeout(tabId) {
    setTimeout(function() {
      if (!queueActive || queueTabId !== tabId) return;
      console.log('[Bridge] Safety timeout fired for tab', tabId);
      advanceQueue();
    }, 20000);
  }

  function stopQueue() {
    queueActive = false;
    queueUrls   = [];
    if (queueTabId) {
      try { chrome.tabs.remove(queueTabId, function() {}); } catch(e) {}
      queueTabId = null;
    }
    window.postMessage({ type: 'QUEUE_ABORTED', done: queueDone, total: queueTotal }, '*');
  }

  // ── STORAGE CHANGE — advances queue when content.js saves data ────────────
  safe(function() {
    chrome.storage.onChanged.addListener(function(changes) {
      if (!changes.buybox_products) return;
      setTimeout(function() {
        syncProducts();
        if (queueActive) {
          console.log('[Bridge] storage.onChanged — advancing queue');
          advanceQueue();
        }
      }, 600);
    });
  });

  // ── WINDOW MESSAGES ───────────────────────────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type) return;

    if (ev.data.type === 'START_QUEUE') {
      // Direct call — NOT wrapped in safe() so it always runs
      if (dead) { console.warn('[Bridge] dead — reloading extension needed'); return; }
      startQueue(ev.data.urls || []);
      return;
    }

    if (ev.data.type === 'STOP_QUEUE') { stopQueue(); return; }
    if (ev.data.type === 'REQUEST_EXTENSION') { announce(); return; }

    if (ev.data.type === 'SAVE_PORTAL_FILE') {
      safe(function() {
        chrome.storage.local.set({ portal_upload_file: ev.data.base64, portal_upload_filename: ev.data.filename });
      });
    }
  });

  announce();
  syncProducts();
  announceInterval = setInterval(announce,     4000);
  syncInterval     = setInterval(syncProducts, 6000);

  console.log('[BuyBox Bridge v8] Active');
})();
