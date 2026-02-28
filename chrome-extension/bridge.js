// bridge.js v9 — routes tab creation through background.js (MV3 content script fix)
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
  let safetyTimer = null;
  let advanceLock = false; // prevent double-advance

  function isAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch(e) { return false; }
  }

  function killAll() {
    try { clearInterval(syncInterval); } catch(e) {}
    try { clearInterval(announceInterval); } catch(e) {}
    syncInterval = announceInterval = null;
    dead = true;
    queueActive = false;
  }

  function safe(fn) {
    if (dead) return;
    if (!isAlive()) return;
    try { fn(); } catch(e) {
      if (/context invalidated|extension context/i.test(e.message || '')) killAll();
    }
  }

  // ── Tab helpers via background relay ─────────────────────────────────────
  function bgCreateTab(url, cb) {
    chrome.runtime.sendMessage({ action: 'create_tab', url: url }, function(resp) {
      if (chrome.runtime.lastError || !resp || resp.error) {
        var err = (resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'unknown';
        console.error('[Bridge v9] create_tab error:', err);
        postLog('❌ Tab error: ' + err + ' — skipping URL');
        cb(null);
      } else {
        console.log('[Bridge v9] Tab created id=' + resp.tabId);
        cb(resp.tabId);
      }
    });
  }

  function bgUpdateTab(tabId, url, cb) {
    chrome.runtime.sendMessage({ action: 'update_tab', tabId: tabId, url: url }, function(resp) {
      if (chrome.runtime.lastError || !resp || resp.error) {
        bgCreateTab(url, cb); // fallback: create new
      } else {
        cb(tabId);
      }
    });
  }

  function bgRemoveTab(tabId) {
    if (!tabId) return;
    chrome.runtime.sendMessage({ action: 'remove_tab', tabId: tabId }, function() {});
  }

  function postLog(msg) {
    window.postMessage({ type: 'SCRAPER_LOG', msg: msg }, '*');
  }

  // ── Announce ──────────────────────────────────────────────────────────────
  function announce() {
    safe(function() {
      window.postMessage({ type: 'MAKRO_EXTENSION_READY', extensionId: chrome.runtime.id }, '*');
    });
  }

  // ── Sync products from chrome.storage → localStorage ──────────────────────
  function syncProducts() {
    safe(function() {
      chrome.storage.local.get(['buybox_products'], function(r) {
        if (chrome.runtime.lastError) return;
        var raw = r.buybox_products || [];
        if (!raw.length) return;
        var existing = [];
        try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) {}
        raw.forEach(function(p) {
          var idx = existing.findIndex(function(e) { return e.url === p.url; });
          var seller = p.buyBoxSeller || 'Unknown Seller';
          var price = parseFloat(p.buyBoxPrice) || 0;
          var entry = {
            url: p.url, fsn: p.fsn || '',
            sku: (p.sku && !p.sku.startsWith('itm')) ? p.sku : '',
            title: p.title || p.url,
            buybox_price: price, seller: seller, status: 'unknown',
            lastChecked: p.timestamp || new Date().toISOString(),
            history: []
          };
          if (idx >= 0) {
            var prev = existing[idx];
            entry.history = prev.history || [];
            var lastP = entry.history.length ? entry.history[entry.history.length-1].price : null;
            if (price > 0 && price !== lastP) {
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

  // ── Queue ─────────────────────────────────────────────────────────────────
  function startQueue(urls) {
    console.log('[Bridge v9] startQueue', urls.length);
    postLog('🔗 Bridge v9 active — opening tabs via background');
    queueUrls    = urls.slice();
    queueTotal   = urls.length;
    queueDone    = 0;
    queueActive  = true;
    advanceLock  = false;
    queueTabId   = null;
    openNextUrl();
  }

  function openNextUrl() {
    if (!queueActive) return;
    if (!queueUrls.length) {
      finishQueue();
      return;
    }
    if (!isAlive()) {
      postLog('❌ Extension context lost — reload page (F5) and try again');
      queueActive = false;
      window.postMessage({ type: 'QUEUE_ABORTED', done: queueDone, total: queueTotal }, '*');
      return;
    }

    advanceLock = false;
    var url = queueUrls.shift();
    postLog('🌐 Loading: ' + url.slice(0, 70));
    console.log('[Bridge v9] openNextUrl:', url.slice(0, 80));

    function onTab(tabId) {
      if (!tabId) { advance(); return; } // tab creation failed, skip
      queueTabId = tabId;
      // Safety timeout: if content.js doesn't fire within 22s, move on
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(function() {
        if (!queueActive || advanceLock) return;
        postLog('⏱ Timeout — moving to next URL');
        advance();
      }, 22000);
    }

    if (queueTabId) {
      bgUpdateTab(queueTabId, url, onTab);
    } else {
      bgCreateTab(url, onTab);
    }
  }

  function advance() {
    if (advanceLock) return; // prevent double-advance
    advanceLock = true;
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    if (!queueActive) return;
    queueDone++;
    window.postMessage({ type: 'QUEUE_PROGRESS', done: queueDone, total: queueTotal, data: null }, '*');
    syncProducts();
    var delay = 4000 + Math.floor(Math.random() * 5000);
    console.log('[Bridge v9] advance — next in', delay, 'ms');
    setTimeout(openNextUrl, delay);
  }

  function finishQueue() {
    queueActive = false;
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    window.postMessage({ type: 'QUEUE_FINISHED', done: queueDone, total: queueTotal }, '*');
    bgRemoveTab(queueTabId);
    queueTabId = null;
  }

  function stopQueue() {
    queueActive = false;
    queueUrls = [];
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    bgRemoveTab(queueTabId);
    queueTabId = null;
    window.postMessage({ type: 'QUEUE_ABORTED', done: queueDone, total: queueTotal }, '*');
  }

  // ── storage.onChanged: content.js saved → advance queue ───────────────────
  safe(function() {
    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area !== 'local' || !changes.buybox_products) return;
      setTimeout(function() {
        syncProducts();
        if (queueActive && !advanceLock) {
          postLog('✅ Scraped — moving to next URL');
          advance();
        }
      }, 800);
    });
  });

  // ── Window messages ───────────────────────────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type) return;
    var t = ev.data.type;
    if (t === 'START_QUEUE') {
      if (!isAlive()) {
        alert('Extension context lost. Please reload the page (F5) and try again.');
        return;
      }
      startQueue(ev.data.urls || []);
      return;
    }
    if (t === 'STOP_QUEUE')  { stopQueue(); return; }
    if (t === 'REQUEST_EXTENSION') { announce(); return; }
    if (t === 'SAVE_PORTAL_FILE') {
      safe(function() {
        chrome.storage.local.set({ portal_upload_file: ev.data.base64, portal_upload_filename: ev.data.filename });
      });
    }
  });

  announce();
  syncProducts();
  announceInterval = setInterval(announce,     4000);
  syncInterval     = setInterval(syncProducts, 6000);

  console.log('[BuyBox Bridge v9] Ready');
})();
