// bridge.js v4 — polling-based, no push messages from background
// bridge.js v5 — grace-period context check, self-healing

(function() {
  'use strict';

  const STORAGE_KEY = 'makro_buybox_v2';
  let dead             = false;
  let failCount        = 0;       // consecutive isAlive failures
  const FAIL_THRESHOLD = 5;       // only kill after 5 consecutive failures
  let syncInterval     = null;
  let announceInterval = null;
  let pollInterval     = null;

  // ── CONTEXT CHECK — with grace period ────────────────────────────────────
  function isAlive() {
    try {
      const ok = !!(chrome && chrome.runtime && chrome.runtime.id);
      if (ok) { failCount = 0; return true; }
      failCount++;
      return false;
    } catch(e) {
      failCount++;
      return false;
    }
  }

  function killAll() {
    try { clearInterval(syncInterval); }     catch(e) {}
    try { clearInterval(announceInterval); } catch(e) {}
    try { clearInterval(pollInterval); }     catch(e) {}
    syncInterval = announceInterval = pollInterval = null;
    dead = true;
    console.warn('[BuyBox Bridge v5] Extension truly unloaded — bridge stopped.');
  }

  function safe(fn) {
    if (dead) return;
    if (!isAlive()) {
      // Only permanently kill after FAIL_THRESHOLD consecutive failures
      if (failCount >= FAIL_THRESHOLD) {
        killAll();
      }
      // Otherwise just skip this tick silently
      return;
    }
    try { fn(); } catch(e) {
      if (/context invalidated|extension context/i.test(e.message || '')) {
        failCount++;
        if (failCount >= FAIL_THRESHOLD) killAll();
      } else {
        console.warn('[Bridge v5]', e.message);
      }
    }
  }

  // ── ANNOUNCE ──────────────────────────────────────────────────────────────
  function announce() {
    safe(function() {
      window.postMessage({ type: 'MAKRO_EXTENSION_READY', extensionId: chrome.runtime.id }, '*');
    });
  }

  // ── SYNC scraped products → dashboard localStorage ────────────────────────
  function syncProducts() {
    safe(function() {
      chrome.storage.local.get(['buybox_products'], function(r) {
        if (chrome.runtime.lastError) return;
        const raw = r.buybox_products || [];
        if (!raw.length) return;

        let existing = [];
        try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) {}

        raw.forEach(function(p) {
          const url    = p.url;
          const idx    = existing.findIndex(function(e) { return e.url === url; });
          const seller = p.buyBoxSeller || 'Unknown Seller';
          const price  = parseFloat(p.buyBoxPrice) || 0;

          const entry = {
            url, fsn: p.fsn || '', sku: p.sku || '',
            title: p.title || url, buybox_price: price,
            seller, status: 'unknown',
            lastChecked: p.timestamp || new Date().toISOString(),
            history: []
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

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
          localStorage.setItem('makro_last_scrape', new Date().toISOString());
        } catch(e) {}

        window.postMessage({ type: 'PRODUCTS_UPDATED', count: existing.length }, '*');
      });
    });
  }

  // ── POLL QUEUE STATE → forward progress to dashboard ─────────────────────
  // Instead of relying on background push messages (which break with SW sleep),
  // we poll chrome.storage every 2s to check queue progress
  let lastDone  = -1;
  let lastActive = false;
  let wasActive  = false;

  function pollQueueState() {
    safe(function() {
      chrome.storage.local.get(['bbp_queue_state', 'buybox_products'], function(r) {
        if (chrome.runtime.lastError) return;
        const s = r.bbp_queue_state;
        if (!s) return;

        // Queue just became active
        if (s.active && !wasActive) {
          wasActive = true;
          lastDone  = 0;
        }

        // Progress: done count changed
        if (s.active && s.done !== lastDone) {
          lastDone = s.done;
          // Sync products to dashboard whenever we get a new scrape
          const raw = r.buybox_products || [];
          if (raw.length) {
            // Find the most recently scraped product
            const latest = raw[raw.length - 1];
            window.postMessage({
              type:  'QUEUE_PROGRESS',
              data:  latest ? {
                url:          latest.url,
                title:        latest.title || '',
                buyBoxPrice:  latest.buyBoxPrice || 0,
                buyBoxSeller: latest.buyBoxSeller || '',
                fsn:          latest.fsn || '',
                sku:          latest.sku || ''
              } : null,
              done:  s.done,
              total: s.total
            }, '*');
            syncProducts();
          }
        }

        // Queue finished
        if (!s.active && wasActive) {
          wasActive = false;
          if (s.aborted) {
            window.postMessage({ type: 'QUEUE_ABORTED', done: s.done, total: s.total }, '*');
          } else {
            window.postMessage({ type: 'QUEUE_FINISHED', done: s.done, total: s.total }, '*');
          }
          syncProducts();
        }
      });
    });
  }

  // ── WINDOW MESSAGE HANDLER ────────────────────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type || dead) return;

    if (ev.data.type === 'START_QUEUE') {
      safe(function() {
        lastDone  = -1;
        wasActive = false;
        chrome.runtime.sendMessage(
          { action: 'queue_scrape', urls: ev.data.urls },
          function(resp) {
            if (chrome.runtime.lastError) {
              console.error('[Bridge] queue_scrape error:', chrome.runtime.lastError.message);
              // Try waking SW and retry once
              setTimeout(function() {
                safe(function() {
                  chrome.runtime.sendMessage({ action: 'queue_scrape', urls: ev.data.urls }, function() {});
                });
              }, 1000);
              return;
            }
            console.log('[Bridge] Queue started:', resp);
          }
        );
      });
    }

    if (ev.data.type === 'STOP_QUEUE') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'stop_queue' }, function() {});
      });
    }

    if (ev.data.type === 'SAVE_PORTAL_FILE') {
      safe(function() {
        chrome.storage.local.set({
          portal_upload_file:     ev.data.base64,
          portal_upload_filename: ev.data.filename
        });
      });
    }

    if (ev.data.type === 'REQUEST_EXTENSION') announce();
  });

  // ── STORAGE CHANGE — instant product sync ────────────────────────────────
  safe(function() {
    chrome.storage.onChanged.addListener(function(changes) {
      if (changes.buybox_products) setTimeout(syncProducts, 300);
    });
  });

  // ── START ─────────────────────────────────────────────────────────────────
  announce();
  syncProducts();
  announceInterval = setInterval(announce,       5000);
  syncInterval     = setInterval(syncProducts,   8000);
  pollInterval     = setInterval(pollQueueState, 3000);

  console.log('[BuyBox Bridge v5] Active — poll every 3s, kills only after 5 consecutive failures');
})();
