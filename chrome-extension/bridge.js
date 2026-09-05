// bridge.js v3.2 — stable context handling + concurrency fix + visual indicator
// FIX: concurrency now defaults to 5 (not 1) so work PC scrapes all tabs

(function() {
  'use strict';

  // ── VISUAL INDICATOR — proves bridge is loaded ────────────────────────────
  var indicator = document.createElement('div');
  indicator.id = 'bbp-bridge-indicator';
  indicator.textContent = '🔗 BBP Bridge v3.2 Connected';
  indicator.style.cssText = 'position:fixed;top:4px;right:4px;z-index:999999;background:#00e5a0;color:#1a1a2e;padding:4px 10px;border-radius:6px;font:bold 11px monospace;pointer-events:none;opacity:0.9;transition:opacity 0.5s';
  document.documentElement.appendChild(indicator);
  setTimeout(function() { indicator.style.opacity = '0'; }, 4000);
  setTimeout(function() { try { indicator.remove(); } catch(e) {} }, 5000);
  console.log('[BBP Bridge v3.2] Loaded and running on:', window.location.href);

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

  // ── SYNC chrome.storage → dashboard localStorage (fast track) ─────────────
  // The fast-track list lives in dashboard localStorage (bbp_fasttrack). Persist
  // it to chrome.storage too so it survives dashboard refreshes and even
  // localStorage clears. Restore only when the dashboard has NEVER set a list
  // (null) — an empty array means the user deliberately cleared it.
  function syncFastTrackToLocal() {
    safe(function() {
      chrome.storage.local.get(['bbp_fasttrack', 'bbp_fasttrack_interval', 'bbp_fasttrack_paused'], function(r) {
        try {
          if (chrome.runtime.lastError) return;
          var restored = false;
          if (localStorage.getItem('bbp_fasttrack') === null && r.bbp_fasttrack) {
            localStorage.setItem('bbp_fasttrack', JSON.stringify(r.bbp_fasttrack));
            restored = true;
          }
          if (localStorage.getItem('bbp_fasttrack_interval') === null && r.bbp_fasttrack_interval) {
            localStorage.setItem('bbp_fasttrack_interval', r.bbp_fasttrack_interval);
          }
          if (localStorage.getItem('bbp_fasttrack_paused') === null && r.bbp_fasttrack_paused) {
            localStorage.setItem('bbp_fasttrack_paused', r.bbp_fasttrack_paused);
          }
          if (restored) window.postMessage({ type: 'FASTTRACK_RESTORED' }, '*');
        } catch(e) {}
      });
    });
  }

  // ── SYNC chrome.storage → dashboard localStorage ──────────────────────────
  function getDeletedSet() {
    try { return JSON.parse(localStorage.getItem('makro_deleted') || '[]'); } catch(e) { return []; }
  }

  function syncToLocalStorage() {
    safe(function() {
      chrome.storage.local.get(['buybox_products'], function(r) {
        try {
          if (chrome.runtime.lastError) return;
          const raw = r.buybox_products || [];
          if (raw.length === 0) return;

          // Load deleted blocklist — URLs and FSNs the user has explicitly removed
          const deleted = getDeletedSet();

          let existing = [];
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) existing = JSON.parse(saved);
          } catch(e) {}

          raw.forEach(function(p) {
            const url = p.url || '';
            const fsn = (p.fsn || '').toUpperCase();

            // Skip if this URL or FSN was explicitly deleted by the user
            if (deleted.includes(url) || (fsn && deleted.includes(fsn))) return;

            const idx = existing.findIndex(function(e) { return e.url === url; });
            const seller = p.buyBoxSeller || 'Unknown Seller';
            const price  = parseFloat(p.buyBoxPrice) || 0;
            const sku    = p.sku || '';

            const entry = {
              url, fsn, sku,
              title:          p.title || url,
              buybox_price:   price,
              seller:         seller,
              status:         'unknown',
              lastChecked:    p.timestamp || new Date().toISOString(),
              history:        [],
              sellersUrl:     p.sellersUrl || '',
              sellers:        p.sellers || undefined,
              sellersCount:   p.sellersCount || undefined,
              sellersChecked: p.sellersChecked || undefined,
              dataSource:     p.dataSource || undefined
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
              // ── SKU PERSISTENCE GUARD ─────────────────────────────────────
              // The scraper stores the itm... URL slug as sku. Never let that
              // overwrite a real SKU we already have (stamped from listings) —
              // otherwise every scrape wipes the SKU and the product loses its
              // cost match (no cost → autoReprice skips → prices go stale).
              if (prev.sku && !/^itm/i.test(prev.sku) && (!entry.sku || /^itm/i.test(entry.sku))) {
                entry.sku = prev.sku;
              }
              // Don't let a scrape with no fresh sellers data blank out sellers we already have
              if (entry.sellers === undefined) {
                entry.sellers = prev.sellers;
                entry.sellersCount = prev.sellersCount;
                entry.sellersChecked = prev.sellersChecked;
                entry.dataSource = entry.dataSource || prev.dataSource;
              }
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

    // PING handler — proves bridge is alive and listening
    if (ev.data.type === 'PING') {
      console.log('[BBP Bridge] PING received — responding');
      window.postMessage({ type: 'PONG', bridge: 'v3.2', time: Date.now() }, '*');
      return;
    }

    if (ev.data.type === 'DELETE_PRODUCT') {
      // Add URL and FSN to the deleted blocklist so sync never restores it
      safe(function() {
        const deleted = JSON.parse(localStorage.getItem('makro_deleted') || '[]');
        if (ev.data.url && !deleted.includes(ev.data.url)) deleted.push(ev.data.url);
        if (ev.data.fsn && !deleted.includes(ev.data.fsn)) deleted.push(ev.data.fsn.toUpperCase());
        localStorage.setItem('makro_deleted', JSON.stringify(deleted));

        // Also remove from chrome.storage.local so it won't resurface
        chrome.storage.local.get(['buybox_products'], function(r) {
          if (chrome.runtime.lastError) return;
          const prods = (r.buybox_products || []).filter(function(p) {
            return p.url !== ev.data.url && (p.fsn || '').toUpperCase() !== (ev.data.fsn || '').toUpperCase();
          });
          chrome.storage.local.set({ buybox_products: prods });
        });
      });
    }

    if (ev.data.type === 'CLEAR_ALL_PRODUCTS') {
      safe(function() {
        chrome.storage.local.set({ buybox_products: [] });
        localStorage.removeItem('makro_deleted');
      });
    }

    if (ev.data.type === 'SAVE_PORTAL_FILE') {
      safe(function() {
        chrome.storage.local.set({
          portal_upload_file: ev.data.base64,
          portal_upload_filename: ev.data.filename
        }, function() {
          console.log('[Bridge] Portal file saved to chrome.storage:', ev.data.filename);
          // Auto-upload flag: portal.js picks this up and uploads without any clicks
          if (ev.data.autoUpload) {
            chrome.storage.local.set({ bbp_auto_upload: true }, function() {
              console.log('[Bridge] bbp_auto_upload = true — portal.js will auto-upload.');
            });
          }
        });
      });
    }

    // ── SAVE FAST TRACK (dashboard → chrome.storage) ────────────────────────
    // Dashboard persists its fast-track list (bbp_fasttrack + interval + pause)
    // here so it survives dashboard refreshes and even localStorage clears.
    if (ev.data.type === 'SAVE_FASTTRACK') {
      safe(function() {
        chrome.storage.local.set({
          bbp_fasttrack: ev.data.list || [],
          bbp_fasttrack_interval: ev.data.interval || null,
          bbp_fasttrack_paused: ev.data.paused || null
        }, function() {
          console.log('[Bridge] Fast track saved to chrome.storage:', (ev.data.list || []).length, 'products');
        });
      });
    }

    if (ev.data.type === 'START_QUEUE') {
      // FIX: default concurrency to 5 (not 1) — matches dashboard default setting
      // ev.data.concurrency is sent from the dashboard and reads localStorage scrape_parallel
      // On a fresh/work PC where localStorage is empty, this ensures 5 tabs are still used
      safe(function() {
        var concurrency = parseInt(ev.data.concurrency) || 5;
        console.log('[Bridge] Starting queue — ' + (ev.data.urls || []).length + ' URLs, concurrency: ' + concurrency);
        chrome.runtime.sendMessage({ action: 'queue_scrape', urls: ev.data.urls, concurrency: concurrency }, function(resp) {
          // Report the result back to the dashboard — it must not assume the
          // queue started. Background can refuse ("Already running") or the
          // bridge context can be invalidated after an extension reload.
          var err = chrome.runtime.lastError ? chrome.runtime.lastError.message
                   : (resp && resp.error) || null;
          window.postMessage({ type: 'QUEUE_STARTED', ok: !!(resp && resp.started), error: err }, '*');
          if (chrome.runtime.lastError) return;
          console.log('[Bridge] Queue started:', resp);
        });
      });
    }

    // ── FAST-TRACK API BATCH SCRAPE (dashboard → background) ────────────────
    // Dashboard sends FSNs; background forwards to ONE Makro tab's content
    // script which loops the sellers API (no page loads). Progress/done come
    // back through chrome.runtime.onMessage below.
    if (ev.data.type === 'FASTTRACK_API_SCRAPE') {
      safe(function() {
        chrome.runtime.sendMessage({
          action: 'fasttrack_api_scrape',
          fsns: ev.data.fsns || [],
          concurrency: parseInt(ev.data.concurrency) || 6
        }, function(resp) {
          var err = chrome.runtime.lastError ? chrome.runtime.lastError.message
                   : (resp && resp.error) || null;
          window.postMessage({ type: 'FASTTRACK_API_STARTED', ok: !!(resp && resp.started), error: err }, '*');
          if (chrome.runtime.lastError) return;
          console.log('[Bridge] Fast-track API scrape started:', resp);
        });
      });
    }

    if (ev.data.type === 'STOP_QUEUE') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'stop_queue' }, function(){});
      });
    }

    // ── FAST-TRACK API STOP (dashboard → background) ────────────────────────
    if (ev.data.type === 'FASTTRACK_API_STOP') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'fasttrack_api_stop' }, function(){});
      });
    }

    if (ev.data.type === 'REFRESH_PORTAL_SESSION') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'portal_refresh_session' }, function(resp) {
          var err = chrome.runtime.lastError ? chrome.runtime.lastError.message
                   : (resp && resp.error) || null;
          window.postMessage({ type: 'REFRESH_PORTAL_SESSION_RESULT', ok: !!(resp && resp.ok), error: err }, '*');
          if (chrome.runtime.lastError) return;
          console.log('[Bridge] Portal session refresh:', resp);
        });
      });
    }

    if (ev.data.type === 'RESUME_AFTER_CHALLENGE') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'resume_after_challenge' }, function(resp) {
          if (chrome.runtime.lastError) return;
          console.log('[Bridge] Resumed after challenge:', resp);
        });
      });
    }

    if (ev.data.type === 'CAT_SEARCH_START') {
      safe(function() {
        chrome.runtime.sendMessage({
          action: 'cat_search_start',
          items: ev.data.items,
          concurrency: ev.data.concurrency || 2
        }, function(r) {
          if (chrome.runtime.lastError) return;
          window.postMessage({ type: 'CAT_SEARCH_STARTED', total: r && r.total }, '*');
        });
      });
    }

    if (ev.data.type === 'CAT_SEARCH_STOP') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'cat_search_stop' }, function(r) {
          window.postMessage({ type: 'CAT_SEARCH_STOPPED', found: r && r.found }, '*');
        });
      });
    }

    if (ev.data.type === 'CAT_GET_RESULTS') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'cat_search_get_results' }, function(r) {
          window.postMessage({ type: 'CAT_RESULTS', results: r && r.results }, '*');
        });
      });
    }

    // ── DIRECT PRICE PUSH ──────────────────────────────────────────────────
    if (ev.data.type === 'UPDATE_PRICE') {
      console.log('[Bridge] UPDATE_PRICE received:', ev.data.req);
      safe(function() {
        chrome.runtime.sendMessage({
          action: 'portal_update_price',
          req: ev.data.req
        }, function(r) {
          var err = chrome.runtime.lastError ? chrome.runtime.lastError.message : (r && r.error) || null;
          console.log('[Bridge] UPDATE_PRICE response:', r, 'error:', err);
          window.postMessage({ type: 'UPDATE_PRICE_RESULT', ok: !!(r && r.ok), result: r, error: err }, '*');
        });
      });
    }

    if (ev.data.type === 'BATCH_UPDATE_PRICES') {
      console.log('[Bridge] BATCH_UPDATE_PRICES received:', ev.data.items && ev.data.items.length, 'items');
      safe(function() {
        chrome.runtime.sendMessage({
          action: 'portal_batch_update_prices',
          items: ev.data.items
        }, function(r) {
          var err = chrome.runtime.lastError ? chrome.runtime.lastError.message : (r && r.error) || null;
          console.log('[Bridge] BATCH_UPDATE_PRICES response:', r, 'error:', err);
          window.postMessage({ type: 'BATCH_UPDATE_PRICES_RESULT', ok: !!(r && r.ok), results: r && r.results, total: r && r.total, error: err }, '*');
        });
      });
    }

    if (ev.data.type === 'REQUEST_EXTENSION') announce();

    // ── SET PORTAL NOTE (dashboard → portal overlay) ────────────────────────
    // The dashboard detects "we're winning the buybox but Makro hasn't updated
    // the live site yet" and sends the note text here. We persist it to
    // chrome.storage so portal.js can display it in the seller-portal overlay.
    if (ev.data.type === 'SET_PORTAL_NOTE') {
      safe(function() {
        chrome.storage.local.set({ bbp_portal_note: { msg: ev.data.msg, ts: Date.now() } }, function() {
          console.log('[Bridge] Portal note set:', ev.data.msg);
        });
      });
    }

    // ── PORTAL API PULLS (dashboard → seller tab via background) ────────────
    if (ev.data.type === 'PORTAL_GET_ORDERS') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'portal_get_orders' }, function(resp) {
          if (chrome.runtime.lastError) {
            window.postMessage({ type: 'PORTAL_ORDERS', ok: false, error: 'Extension error' }, '*');
            return;
          }
          window.postMessage({
            type: 'PORTAL_ORDERS',
            ok: !!(resp && resp.ok),
            orders: resp && resp.orders,
            counts: resp && resp.counts,
            error: resp && resp.error
          }, '*');
        });
      });
    }

    if (ev.data.type === 'PORTAL_GET_LISTINGS') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'portal_get_listings' }, function(resp) {
          if (chrome.runtime.lastError) {
            window.postMessage({ type: 'PORTAL_LISTINGS', ok: false, error: 'Extension error' }, '*');
            return;
          }
          window.postMessage({
            type: 'PORTAL_LISTINGS',
            ok: !!(resp && resp.ok),
            listings: resp && resp.listings,
            counts: resp && resp.counts,
            stockMap: resp && resp.stockMap,
            error: resp && resp.error
          }, '*');
        });
      });
    }

    // ── PORTAL LOOKUP PRODUCT (read-only — dashboard → seller tab) ─────────
    if (ev.data.type === 'PORTAL_LOOKUP_PRODUCT') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'portal_lookup_product', fsn: ev.data.fsn }, function(resp) {
          if (chrome.runtime.lastError) {
            window.postMessage({ type: 'PORTAL_LOOKUP_PRODUCT_RESULT', ok: false, error: 'Extension error' }, '*');
            return;
          }
          window.postMessage({
            type: 'PORTAL_LOOKUP_PRODUCT_RESULT',
            ok: !!(resp && resp.ok),
            data: resp && resp.data,
            error: resp && resp.error
          }, '*');
        });
      });
    }

    // ── PORTAL LIST PRODUCT (latch-on WRITE — dashboard → seller tab) ──────
    if (ev.data.type === 'PORTAL_LIST_PRODUCT') {
      safe(function() {
        chrome.runtime.sendMessage({ action: 'portal_list_product', req: ev.data.req }, function(resp) {
          if (chrome.runtime.lastError) {
            window.postMessage({ type: 'PORTAL_LIST_PRODUCT_RESULT', ok: false, error: 'Extension error' }, '*');
            return;
          }
          window.postMessage({
            type: 'PORTAL_LIST_PRODUCT_RESULT',
            ok: !!(resp && resp.ok),
            dryRun: resp && resp.dryRun,
            payload: resp && resp.payload,
            result: resp && resp.result,
            sellerId: resp && resp.sellerId,
            error: resp && resp.error
          }, '*');
        });
      });
    }
  });

  // Forward scrape_done, queue_finished, queue_aborted from background → dashboard
  safe(function() {
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.action === 'scrape_done') {
        window.postMessage({ type: 'QUEUE_PROGRESS', data: msg.data, done: msg.done, total: msg.total }, '*');
      }
      if (msg.action === 'queue_finished') {
        window.postMessage({ type: 'QUEUE_FINISHED', done: msg.done, total: msg.total }, '*');
      }
      if (msg.action === 'queue_aborted') {
        window.postMessage({ type: 'QUEUE_ABORTED', done: msg.done, total: msg.total }, '*');
      }
      if (msg.action === 'challenge_detected') {
        window.postMessage({ type: 'CHALLENGE_DETECTED', tabId: msg.tabId, url: msg.url }, '*');
      }
      // Catalogue search events
      if (msg.action === 'cat_search_progress') {
        window.postMessage({ type: 'CAT_SEARCH_PROGRESS',
          done: msg.done, total: msg.total, found: msg.found,
          lastSku: msg.lastSku, lastUrl: msg.lastUrl }, '*');
      }
      if (msg.action === 'cat_search_finished') {
        window.postMessage({ type: 'CAT_SEARCH_FINISHED', done: msg.done, total: msg.total, found: msg.found }, '*');
      }
      if (msg.action === 'sellers_updated') {
        window.postMessage({ type: 'SELLERS_UPDATED', fsn: msg.fsn, count: msg.count }, '*');
      }
      // Fast-track API batch scrape events
      if (msg.action === 'fasttrack_api_progress') {
        window.postMessage({ type: 'FASTTRACK_API_PROGRESS', done: msg.done, total: msg.total, result: msg.result }, '*');
      }
      if (msg.action === 'fasttrack_api_done') {
        window.postMessage({ type: 'FASTTRACK_API_DONE', results: msg.results || [], stopped: !!msg.stopped }, '*');
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
  syncFastTrackToLocal();
  announceInterval = setInterval(announce, 4000);
  syncInterval     = setInterval(syncToLocalStorage, 5000);

  console.log('[BuyBox Bridge v3.1] Active — concurrency default: 5');
})();
