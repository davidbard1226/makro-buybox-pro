// bridge.js v6 — self-healing, never dies permanently during active scrape

(function() {
  'use strict';

  const STORAGE_KEY    = 'makro_buybox_v2';
  let dead             = false;
  let failCount        = 0;
  const FAIL_THRESHOLD = 20;   // 20 consecutive failures = 40s before giving up
  let syncInterval     = null;
  let announceInterval = null;
  let pollInterval     = null;
  let lastDone         = -1;
  let wasActive        = false;

  // ── CONTEXT CHECK ─────────────────────────────────────────────────────────
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
    console.warn('[BuyBox Bridge v6] Extension unloaded — bridge stopped.');
  }

  // safe() — skips tick if context unavailable, only permanently kills after
  // FAIL_THRESHOLD consecutive failures (~40 seconds)
  function safe(fn) {
    if (dead) return;
    if (!isAlive()) {
      if (failCount >= FAIL_THRESHOLD) killAll();
      return; // skip this tick silently — SW may just be sleeping
    }
    try { fn(); } catch(e) {
      if (/context invalidated|extension context/i.test(e.message || '')) {
        failCount++;
        if (failCount >= FAIL_THRESHOLD) killAll();
        // else: silently skip, SW is waking up
      } else {
        console.warn('[Bridge v6]', e.message);
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
            url, fsn: p.fsn || '',
            // Never store itm... URL slugs as SKU — real SKU comes from listings XLS
            sku: (p.sku && !p.sku.startsWith('itm')) ? p.sku : '',
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

  // ── POLL QUEUE STATE ───────────────────────────────────────────────────────
  // Polls chrome.storage every 2s for queue progress.
  // If chrome APIs are momentarily unavailable (SW sleeping), skips silently.
  function pollQueueState() {
    // If context gone but scrape was active, don't kill — just skip this tick
    if (dead) return;
    if (!isAlive()) {
      if (failCount >= FAIL_THRESHOLD) killAll();
      return;
    }

    try {
      chrome.storage.local.get(['bbp_queue_state', 'buybox_products'], function(r) {
        if (chrome.runtime.lastError) return; // SW sleeping — skip silently
        const s = r.bbp_queue_state;
        if (!s) return;

        if (s.active && !wasActive) {
          wasActive = true;
          lastDone  = 0;
        }

        if (s.active && s.done !== lastDone) {
          lastDone = s.done;
          const raw    = r.buybox_products || [];
          const latest = raw.length ? raw[raw.length - 1] : null;
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

        if (!s.active && wasActive) {
          wasActive = false;
          if (s.aborted) {
            window.postMessage({ type: 'QUEUE_ABORTED',   done: s.done, total: s.total }, '*');
          } else {
            window.postMessage({ type: 'QUEUE_FINISHED',  done: s.done, total: s.total }, '*');
          }
          syncProducts();
        }
      });
    } catch(e) {
      // Swallow — SW may be momentarily unavailable
    }
  }

  // ── WINDOW MESSAGE HANDLER ────────────────────────────────────────────────
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.type || dead) return;

    if (ev.data.type === 'START_QUEUE') {
      safe(function() {
        lastDone  = -1;
        wasActive = false;
        // Retry up to 3 times in case SW is waking up
        function tryStart(attempt) {
          chrome.runtime.sendMessage(
            { action: 'queue_scrape', urls: ev.data.urls },
            function(resp) {
              if (chrome.runtime.lastError) {
                if (attempt < 3) setTimeout(function() { tryStart(attempt + 1); }, 1200);
                else console.error('[Bridge v6] Could not start queue after 3 attempts');
                return;
              }
              console.log('[Bridge v6] Queue started:', resp);
            }
          );
        }
        tryStart(1);
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
  announceInterval = setInterval(announce,       4000);
  syncInterval     = setInterval(syncProducts,   6000);
  pollInterval     = setInterval(pollQueueState, 2000);

  console.log('[BuyBox Bridge v6] Active — fail threshold:', FAIL_THRESHOLD, '(~40s grace)');
})();
