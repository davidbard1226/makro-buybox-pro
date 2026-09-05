// background.js v9 — up to 5 concurrent tabs, bot-challenge detection

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['buybox_products'], function(r) {
    if (!r.buybox_products) chrome.storage.local.set({ buybox_products: [] });
  });
});

// ── STATE ─────────────────────────────────────────────────────────────────
let queue        = [];
let active       = false;
let totalUrls    = 0;
let doneCount    = 0;
let concurrency  = 1;
let scrapeWinId  = null;
let activeTabs   = new Map();

// ── CATALOGUE SEARCH STATE ────────────────────────────────────────────────
let catSearchMode    = false;
let catSearchQueue   = [];   // [{sku, query}]
let catSearchTotal   = 0;
let catSearchDone    = 0;
let catSearchResults = {};   // {sku: {url, title}}

// ── HUMAN-LIKE DELAY: 3-8 seconds per slot ───────────────────────────────
function humanDelay() {
  // Wider random range: 3-8s — harder to fingerprint as a bot
  return 3000 + Math.floor(Math.random() * 5000);
}

// ── CHALLENGE DETECTION ──────────────────────────────────────────────────
// Called when a tab navigates to a non-product URL (challenge/redirect page)
let challengePaused = false;
let challengeTabId  = null;

function isChallengeUrl(url) {
  if (!url) return false;
  // Includes Makro's own bot-block redirect (/blocked?url=...&uuid=...) —
  // this was missing before, so a full block was silently swallowed by the
  // 15s per-tab safety timeout instead of pausing the queue and warning.
  return /challenges\.cloudflare\.com|cdn-cgi|interstitial|are-you-human|verify.*human|robot.*check|captcha|makro\.co\.za\/blocked(\?|$)/i.test(url);
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  // ── CATALOGUE SEARCH: START ──────────────────────────────────────────────
  if (msg.action === 'cat_search_start') {
    if (active) { sendResponse({ error: 'Scraper already running — stop it first' }); return true; }
    catSearchQueue   = [...(msg.items || [])];  // [{sku, query}]
    catSearchTotal   = catSearchQueue.length;
    catSearchDone    = 0;
    catSearchResults = {};
    concurrency      = Math.min(Math.max(parseInt(msg.concurrency) || 2, 1), 3);
    active           = true;
    scrapeWinId      = null;
    activeTabs.clear();
    catSearchMode    = true;
    sendResponse({ started: true, total: catSearchTotal });
    openCatSearchWindow();
    return true;
  }

  // ── CATALOGUE SEARCH: RESULT FROM search_content.js ──────────────────────
  if (msg.action === 'search_scraped') {
    if (!active || !catSearchMode) { sendResponse({ ok: true }); return true; }
    const tabId = sender.tab && sender.tab.id;
    const slot  = tabId ? activeTabs.get(tabId) : null;
    if (slot && slot.timeoutId) clearTimeout(slot.timeoutId);
    if (tabId) activeTabs.delete(tabId);

    const d = msg.data || {};
    if (d.foundUrl && slot && slot.sku) {
      catSearchResults[slot.sku] = { url: d.foundUrl, title: d.foundTitle, sku: slot.sku };
    }
    catSearchDone++;

    // Persist results to storage every 10 finds
    if (catSearchDone % 10 === 0) {
      chrome.storage.local.set({ cat_search_results: catSearchResults });
    }

    notifyDashboard({
      action:   'cat_search_progress',
      done:     catSearchDone,
      total:    catSearchTotal,
      found:    Object.keys(catSearchResults).length,
      lastSku:  slot ? slot.sku : '',
      lastUrl:  d.foundUrl || ''
    });

    if (challengePaused) { sendResponse({ ok: true }); return true; }

    const delay = humanDelay() + (activeTabs.size * 1200);
    if (active && catSearchQueue.length > 0) {
      setTimeout(function() { loadNextSearchInTab(tabId); }, delay);
    } else if (active && catSearchQueue.length === 0 && activeTabs.size === 0) {
      finishCatSearch();
    }
    sendResponse({ ok: true });
    return true;
  }

  // ── CATALOGUE SEARCH: STOP ────────────────────────────────────────────────
  if (msg.action === 'cat_search_stop') {
    chrome.storage.local.set({ cat_search_results: catSearchResults });
    shutdownAll();
    catSearchMode = false;
    sendResponse({ stopped: true, found: Object.keys(catSearchResults).length });
    return true;
  }

  // ── CATALOGUE SEARCH: GET RESULTS ─────────────────────────────────────────
  if (msg.action === 'cat_search_get_results') {
    chrome.storage.local.get(['cat_search_results'], function(r) {
      sendResponse({ results: r.cat_search_results || catSearchResults });
    });
    return true;
  }

  // ── CATALOGUE SEARCH: STATUS ──────────────────────────────────────────────
  if (msg.action === 'cat_search_status') {
    sendResponse({
      active: active && catSearchMode,
      done: catSearchDone,
      total: catSearchTotal,
      found: Object.keys(catSearchResults).length,
      remaining: catSearchQueue.length
    });
    return true;
  }

  // ── START QUEUE ──────────────────────────────────────────────────────────
  if (msg.action === 'queue_scrape') {
    if (active) { sendResponse({ error: 'Already running' }); return true; }
    queue        = [...(msg.urls || [])];
    totalUrls    = queue.length;
    doneCount    = 0;
    concurrency  = Math.min(Math.max(parseInt(msg.concurrency) || 1, 1), 5);
    active       = true;
    scrapeWinId  = null;
    activeTabs.clear();
    sendResponse({ started: true, total: totalUrls });
    openScrapeWindow();
    return true;
  }

  // ── STOP QUEUE ───────────────────────────────────────────────────────────
  if (msg.action === 'stop_queue') {
    shutdownAll();
    sendResponse({ stopped: true });
    return true;
  }

  // ── RESUME AFTER CHALLENGE SOLVED ───────────────────────────────────────
  if (msg.action === 'resume_after_challenge') {
    challengePaused = false;
    challengeTabId  = null;
    sendResponse({ resumed: true });
    // Restart queue processing
    if (active && queue.length > 0) {
      setTimeout(function() { loadNextUrlInTab(null); }, humanDelay());
    }
    return true;
  }

  // ── STATUS ───────────────────────────────────────────────────────────────
  if (msg.action === 'queue_status') {
    sendResponse({ active, remaining: queue.length, done: doneCount, total: totalUrls });
    return true;
  }

  // ── PAGE SCRAPED (from content.js) ───────────────────────────────────────
  if (msg.action === 'page_scraped') {
    if (!active) { sendResponse({ ok: true }); return true; }
    const tabId = sender.tab && sender.tab.id;
    const slot = tabId ? activeTabs.get(tabId) : null;
    if (slot && slot.timeoutId) clearTimeout(slot.timeoutId);
    if (tabId) activeTabs.delete(tabId);

    doneCount++;
    notifyDashboard({ action: 'scrape_done', data: msg.data, done: doneCount, total: totalUrls });

    sendResponse({ ok: true });

    // Slight stagger so tabs don't fire simultaneously
    // If queue was paused for a challenge, don't advance until resumed
    if (challengePaused) { return; }
    const delay = humanDelay() + (activeTabs.size * 1500);
    if (active && queue.length > 0) {
      setTimeout(function() { loadNextUrlInTab(tabId); }, delay);
    } else if (active && queue.length === 0 && activeTabs.size === 0) {
      finishQueue();
    }
    return true;
  }

  // ── PORTAL UPLOAD ─────────────────────────────────────────────────────────
  if (msg.action === 'portal_upload_ready') {
    notifyDashboard({ action: 'portal_upload_ready' });
    sendResponse({ ok: true });
    return true;
  }

  // ── SELLERS SCRAPED (from sellers page content.js — manual visit) ──────
  if (msg.action === 'sellers_scraped') {
    var fsn = msg.fsn;
    var sellers = msg.sellers || [];
    if (!fsn || sellers.length === 0) { sendResponse({ ok: true }); return true; }

    // Merge into storage
    chrome.storage.local.get(['buybox_products'], function(r) {
      var products = r.buybox_products || [];
      var idx = products.findIndex(function(p) { return p.fsn === fsn; });
      if (idx >= 0) {
        products[idx].sellers = sellers;
        products[idx].sellersCount = sellers.length;
        products[idx].sellersChecked = new Date().toISOString();
        chrome.storage.local.set({ buybox_products: products });
        notifyDashboard({ action: 'sellers_updated', fsn: fsn, count: sellers.length });
      }
    });

    sendResponse({ ok: true });
    return true;
  }

  // ── REFRESH PORTAL SESSION (dashboard button) ───────────────────────────
  // Capture fresh cookies + CSRF from the logged-in seller tab and POST them
  // to the local server so /api/push-price keeps working after session expiry.
  // Robust version: reads ALL cookies (incl. HttpOnly connect.sid) directly via
  // chrome.cookies.getAll, and pulls the CSRF token from the page's
  // localStorage.__appData via executeScript. Does NOT depend on the content
  // script's document.cookie (which can't see HttpOnly cookies).
  if (msg.action === 'portal_refresh_session') {
    chrome.tabs.query({}, function(tabs) {
      var portalTab = null;
      for (var i = 0; i < tabs.length; i++) {
        var u = tabs[i].url || '';
        if (u.indexOf('https://seller.makro.co.za') === 0) {
          portalTab = tabs[i];
          break;
        }
      }
      if (!portalTab) {
        sendResponse({ ok: false, error: 'no_portal_tab' });
        return;
      }
      // Read ALL cookies for the portal domain — including HttpOnly ones
      // (connect.sid etc.) that document.cookie cannot see.
      chrome.cookies.getAll({ domain: 'seller.makro.co.za' }, function(cookies) {
        var cookieStr = (cookies || []).map(function(c) {
          return c.name + '=' + c.value;
        }).join('; ');
        if (!cookieStr) {
          sendResponse({ ok: false, error: 'no_cookies — log into seller.makro.co.za first' });
          return;
        }
        // Pull CSRF + sellerId + locationId from the page's localStorage.__appData
        chrome.scripting.executeScript({
          target: { tabId: portalTab.id },
          func: function() {
            try {
              var d = JSON.parse(localStorage.getItem('__appData') || '{}');
              return {
                csrfToken: (d.sellerConfig && d.sellerConfig.csrfToken) || '',
                sellerId: (d.sellerConfig && d.sellerConfig.sellerId) || '',
                locationId: d['X-LOCATION-ID'] || ''
              };
            } catch(e) { return { csrfToken: '', sellerId: '', locationId: '' }; }
          }
        }, function(results) {
          var auth = (results && results[0] && results[0].result) || {};
          if (!auth.csrfToken) {
            sendResponse({ ok: false, error: 'no_csrf — reload the portal page and log in' });
            return;
          }
          // POST captured auth to the local server
          var payload = JSON.stringify({
            csrfToken: auth.csrfToken,
            sellerId: auth.sellerId,
            locationId: auth.locationId,
            cookies: cookieStr
          });
          var req = new XMLHttpRequest();
          req.open('POST', 'http://localhost:4321/api/portal-cookies', true);
          req.setRequestHeader('Content-Type', 'application/json');
          req.onload = function() {
            try {
              var j = JSON.parse(req.responseText);
              sendResponse({ ok: !!(j && j.ok), error: j && j.error });
            } catch (e) {
              sendResponse({ ok: false, error: 'server_bad_response' });
            }
          };
          req.onerror = function() {
            sendResponse({ ok: false, error: 'server_unreachable — is server.js running on localhost:4321?' });
          };
          req.send(payload);
        });
      });
    });
    return true; // async
  }

  // ── FAST-TRACK API BATCH SCRAPE ──────────────────────────────────────────
  // Dashboard sends a list of FSNs; we find (or create) ONE Makro tab and ask
  // its content script to loop the sellers API for every FSN — no page loads.
  // Progress/done messages from the content script are relayed to the dashboard.
  if (msg.action === 'fasttrack_api_scrape') {
    var fsns = msg.fsns || [];
    if (!fsns.length) { sendResponse({ error: 'No FSNs' }); return true; }
    // Refuse if a page-load queue is mid-flight — the dashboard guards this
    // too, but never let the two scrape paths overlap in the background.
    if (active) { sendResponse({ error: 'Scraper already running — stop it first' }); return true; }

    chrome.tabs.query({}, function(tabs) {
      var makroTab = null;
      for (var i = 0; i < tabs.length; i++) {
        var u = tabs[i].url || '';
        if (u.indexOf('https://www.makro.co.za') === 0 && !isChallengeUrl(u)) {
          makroTab = tabs[i];
          break;
        }
      }

      function sendBatch(tabId, cb) {
        chrome.tabs.sendMessage(tabId, {
          action: 'fasttrack_api_scrape',
          fsns: fsns,
          concurrency: msg.concurrency || 6
        }, function(resp) {
          if (chrome.runtime.lastError) { cb({ error: 'makro_tab_not_ready' }); return; }
          cb(resp);
        });
      }

      if (makroTab) {
        sendBatch(makroTab.id, function(resp) {
          if (resp && resp.error === 'makro_tab_not_ready') {
            // Content script not injected (tab opened before extension reload).
            injectContentScript(makroTab.id, function(ok) {
              if (!ok) { sendResponse({ error: 'makro_tab_not_ready' }); return; }
              sendBatch(makroTab.id, sendResponse);
            });
            return;
          }
          sendResponse(resp);
        });
      } else {
        // No Makro tab open — create one (homepage) and wait for it to load.
        chrome.tabs.create({ url: 'https://www.makro.co.za/', active: false }, function(tab) {
          if (chrome.runtime.lastError || !tab) { sendResponse({ error: 'makro_tab_failed' }); return; }
          var tries = 0;
          var waitTimer = setInterval(function() {
            tries++;
            chrome.tabs.get(tab.id, function(t) {
              if (chrome.runtime.lastError || !t) {
                clearInterval(waitTimer);
                sendResponse({ error: 'makro_tab_failed' });
                return;
              }
              if (t.status === 'complete' || tries > 20) {
                clearInterval(waitTimer);
                sendBatch(tab.id, function(resp) {
                  if (resp && resp.error === 'makro_tab_not_ready') {
                    injectContentScript(tab.id, function(ok) {
                      if (!ok) { sendResponse({ error: 'makro_tab_not_ready' }); return; }
                      sendBatch(tab.id, sendResponse);
                    });
                    return;
                  }
                  sendResponse(resp);
                });
              }
            });
          }, 500);
        });
      }
    });
    return true; // async
  }

  // ── FAST-TRACK API: STOP ──────────────────────────────────────────────────
  // Dashboard Stop button → tell every Makro tab's content script to halt the
  // batch loop. The content script finalizes with partial results.
  if (msg.action === 'fasttrack_api_stop') {
    chrome.tabs.query({}, function(tabs) {
      for (var i = 0; i < tabs.length; i++) {
        var u = tabs[i].url || '';
        if (u.indexOf('https://www.makro.co.za') === 0) {
          chrome.tabs.sendMessage(tabs[i].id, { action: 'fasttrack_api_stop' }, function() {});
        }
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  // ── FAST-TRACK API: PROGRESS/DONE FROM CONTENT → DASHBOARD ───────────────
  if (msg.action === 'fasttrack_api_progress') {
    notifyDashboard({ action: 'fasttrack_api_progress', done: msg.done, total: msg.total, result: msg.result });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === 'fasttrack_api_done') {
    notifyDashboard({ action: 'fasttrack_api_done', results: msg.results || [], stopped: !!msg.stopped });
    sendResponse({ ok: true });
    return true;
  }

  // ── PORTAL API RELAY (dashboard → seller tab) ────────────────────────────
  if (msg.action === 'portal_get_orders' || msg.action === 'portal_get_listings' || msg.action === 'portal_list_product' || msg.action === 'portal_lookup_product' || msg.action === 'portal_update_price' || msg.action === 'portal_batch_update_prices') {
    chrome.tabs.query({}, function(tabs) {
      var portalTab = null;
      for (var i = 0; i < tabs.length; i++) {
        var u = tabs[i].url || '';
        if (u.indexOf('https://seller.makro.co.za') === 0 ||
            u.indexOf('https://www.makromarketplace.co.za') === 0) {
          portalTab = tabs[i];
          break;
        }
      }
      if (!portalTab) {
        sendResponse({ ok: false, error: 'no_portal_tab' });
        return;
      }
      chrome.tabs.sendMessage(portalTab.id, { action: msg.action, req: msg.req, items: msg.items }, function(resp) {
        if (chrome.runtime.lastError) {
          // Content script not injected (e.g. portal tab was opened before the
          // extension was reloaded). Inject portal_api.js on demand, retry once.
          injectPortalApi(portalTab.id, function(ok) {
            if (!ok) { sendResponse({ ok: false, error: 'portal_not_ready' }); return; }
            chrome.tabs.sendMessage(portalTab.id, { action: msg.action, req: msg.req, items: msg.items }, function(resp2) {
              if (chrome.runtime.lastError) { sendResponse({ ok: false, error: 'portal_not_ready' }); return; }
              sendResponse(resp2);
            });
          });
          return;
        }
        sendResponse(resp);
      });
    });
    return true; // async
  }

  // Inject portal_api.js into the portal tab if it's missing (tab opened
  // before the extension reload). portal_api.js guards against double-load.
  function injectPortalApi(tabId, cb) {
    if (!chrome.scripting || !chrome.scripting.executeScript) { cb(false); return; }
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['portal_api.js']
    }, function() {
      if (chrome.runtime.lastError) { cb(false); return; }
      cb(true);
    });
  }

  // Inject content.js into a Makro tab if it's missing (tab opened before the
  // extension reload). content.js guards against double-load.
  function injectContentScript(tabId, cb) {
    if (!chrome.scripting || !chrome.scripting.executeScript) { cb(false); return; }
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) { cb(false); return; }
      cb(true);
    });
  }
});

// ── OPEN SCRAPE WINDOW WITH FIRST BATCH OF TABS ──────────────────────────
function openScrapeWindow() {
  if (queue.length === 0) return;
  const firstUrl = queue.shift();

  // Defensive cleanup: if a previous scrape window is still around (its close
  // raced or failed), remove it BEFORE creating the new one so tabs never
  // accumulate across cycles.
  if (scrapeWinId) {
    var leftoverWin = scrapeWinId;
    scrapeWinId = null;
    chrome.windows.remove(leftoverWin, function() {});
  }

  chrome.windows.create({
    url: firstUrl,
    type: 'normal',
    width: 1280,
    height: 900,
    left: 50,
    top: 50,
    focused: true
  }, function(win) {
    scrapeWinId = win.id;
    const tabId = win.tabs[0].id;
    registerTab(tabId, firstUrl);

    // Force the scrape window to the front so the user can SEE what's being scraped
    setTimeout(function() {
      if (scrapeWinId) chrome.windows.update(scrapeWinId, { focused: true }, function() {});
    }, 300);

    // Open remaining parallel slots with staggered delays
    for (let i = 1; i < concurrency; i++) {
      if (queue.length === 0) break;
      const url = queue.shift();
      const delay = i * 800;   // stagger by 0.8s per slot
      setTimeout(function() {
        if (!active || !scrapeWinId) return;
        chrome.tabs.create({ windowId: scrapeWinId, url: url, active: false }, function(tab) {
          if (tab) registerTab(tab.id, url);
        });
      }, delay);
    }
  });
}

// ── REGISTER A TAB AND SET SAFETY TIMEOUT ────────────────────────────────
function registerTab(tabId, url) {
  const timeoutId = setTimeout(function() {
    // Safety: if no response in 15s, skip this URL and move on
    if (activeTabs.has(tabId)) {
      activeTabs.delete(tabId);
      doneCount++;
      notifyDashboard({ action: 'scrape_done', data: null, done: doneCount, total: totalUrls });
      if (active && queue.length > 0) {
        setTimeout(function() { loadNextUrlInTab(tabId); }, humanDelay());
      } else if (active && queue.length === 0 && activeTabs.size === 0) {
        finishQueue();
      }
    }
  }, 15000);

  activeTabs.set(tabId, { url, timeoutId });

  // Watch for challenge pages on this tab
  chrome.tabs.onUpdated.addListener(function onUpdated(tId, info) {
    if (tId !== tabId) return;
    if (info.url && isChallengeUrl(info.url)) {
      // CHALLENGE DETECTED — pause queue and alert dashboard
      challengePaused = true;
      challengeTabId  = tabId;
      clearTimeout(activeTabs.get(tabId) && activeTabs.get(tabId).timeoutId);
      notifyDashboard({ action: 'challenge_detected', tabId: tabId, url: info.url });
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
    if (info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
  });
}

// ── NAVIGATE AN EXISTING TAB TO NEXT URL ─────────────────────────────────
function loadNextUrlInTab(tabId) {
  if (!active || queue.length === 0) {
    if (activeTabs.size === 0) finishQueue();
    return;
  }
  const url = queue.shift();

  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError || !tab || tab.windowId !== scrapeWinId) {
      // Tab gone — open a new one in the window
      if (scrapeWinId) {
        chrome.tabs.create({ windowId: scrapeWinId, url: url, active: false }, function(newTab) {
          if (newTab) registerTab(newTab.id, url);
        });
      } else {
        // Window also gone — put URL back and open fresh window
        queue.unshift(url);
        openScrapeWindow();
      }
      return;
    }
    chrome.tabs.update(tabId, { url: url });
    registerTab(tabId, url);
  });
}

// ── CAT SEARCH: OPEN FIRST WINDOW ────────────────────────────────────────
function openCatSearchWindow() {
  if (catSearchQueue.length === 0) return;
  const item   = catSearchQueue.shift();
  const searchUrl = 'https://www.makro.co.za/search?q=' + encodeURIComponent(item.query);

  chrome.windows.create({
    url: searchUrl, type: 'normal',
    width: 1280, height: 900, left: 50, top: 50, focused: true
  }, function(win) {
    scrapeWinId = win.id;
    const tabId = win.tabs[0].id;
    registerSearchTab(tabId, item);

    for (let i = 1; i < concurrency; i++) {
      if (catSearchQueue.length === 0) break;
      const next = catSearchQueue.shift();
      const delay = i * 900;
      setTimeout(function() {
        if (!active || !scrapeWinId) return;
        chrome.tabs.create({
          windowId: scrapeWinId,
          url: 'https://www.makro.co.za/search?q=' + encodeURIComponent(next.query),
          active: false
        }, function(tab) {
          if (tab) registerSearchTab(tab.id, next);
        });
      }, delay);
    }
  });
}

// ── CAT SEARCH: REGISTER TAB ──────────────────────────────────────────────
function registerSearchTab(tabId, item) {
  const timeoutId = setTimeout(function() {
    if (activeTabs.has(tabId)) {
      activeTabs.delete(tabId);
      catSearchDone++;
      notifyDashboard({ action: 'cat_search_progress', done: catSearchDone, total: catSearchTotal, found: Object.keys(catSearchResults).length, lastSku: item.sku, lastUrl: '' });
      if (active && catSearchQueue.length > 0) {
        setTimeout(function() { loadNextSearchInTab(tabId); }, humanDelay());
      } else if (active && catSearchQueue.length === 0 && activeTabs.size === 0) {
        finishCatSearch();
      }
    }
  }, 20000);  // 20s timeout — enough for slow Makro pages + 6s retry in search_content.js

  activeTabs.set(tabId, { url: 'https://www.makro.co.za/search?q=' + encodeURIComponent(item.query), sku: item.sku, query: item.query, timeoutId });

  // Watch for challenge pages
  chrome.tabs.onUpdated.addListener(function onUpdated(tId, info) {
    if (tId !== tabId) return;
    if (info.url && isChallengeUrl(info.url)) {
      challengePaused = true;
      challengeTabId  = tabId;
      const slot = activeTabs.get(tabId);
      if (slot) clearTimeout(slot.timeoutId);
      notifyDashboard({ action: 'challenge_detected', tabId: tabId, url: info.url });
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
    if (info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
  });
}

// ── CAT SEARCH: LOAD NEXT ─────────────────────────────────────────────────
function loadNextSearchInTab(tabId) {
  if (!active || catSearchQueue.length === 0) {
    if (activeTabs.size === 0) finishCatSearch();
    return;
  }
  const item = catSearchQueue.shift();
  const url  = 'https://www.makro.co.za/search?q=' + encodeURIComponent(item.query);

  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError || !tab || tab.windowId !== scrapeWinId) {
      if (scrapeWinId) {
        chrome.tabs.create({ windowId: scrapeWinId, url: url, active: false }, function(t) {
          if (t) registerSearchTab(t.id, item);
        });
      } else {
        catSearchQueue.unshift(item);
        openCatSearchWindow();
      }
      return;
    }
    chrome.tabs.update(tabId, { url: url });
    registerSearchTab(tabId, item);
  });
}

// ── CAT SEARCH: FINISH ────────────────────────────────────────────────────
function finishCatSearch() {
  active        = false;
  catSearchMode = false;
  chrome.storage.local.set({ cat_search_results: catSearchResults });
  setTimeout(function() {
    notifyDashboard({
      action: 'cat_search_finished',
      done:   catSearchDone,
      total:  catSearchTotal,
      found:  Object.keys(catSearchResults).length
    });
    // Same window-id capture as finishQueue — never let a new cycle steal
    // this close and leak the old window.
    var winToClose = scrapeWinId;
    setTimeout(function() {
      if (winToClose) chrome.windows.remove(winToClose, function() {});
      if (scrapeWinId === winToClose) {
        scrapeWinId = null;
        activeTabs.clear();
      }
    }, 2000);
  }, 500);
}

// ── FINISH QUEUE ─────────────────────────────────────────────────────────
function finishQueue() {
  active = false;
  setTimeout(function() {
    notifyDashboard({ action: 'queue_finished', done: doneCount, total: totalUrls });
    // Capture the window id NOW (at schedule time). If a new scrape cycle
    // starts before this fires, the close must target THIS window — reading
    // scrapeWinId at fire time would remove the NEW window and leak the old
    // one open forever (the "tabs keep accumulating" bug).
    var winToClose = scrapeWinId;
    setTimeout(function() {
      if (winToClose) chrome.windows.remove(winToClose, function() {});
      // Only reset shared state if no new cycle took over.
      if (scrapeWinId === winToClose) {
        scrapeWinId = null;
        activeTabs.clear();
      }
    }, 2000);
  }, 500);
}

// ── SHUTDOWN EVERYTHING ───────────────────────────────────────────────────
function shutdownAll() {
  active        = false;
  catSearchMode = false;
  queue         = [];
  catSearchQueue = [];
  activeTabs.forEach(function(slot) { clearTimeout(slot.timeoutId); });
  activeTabs.clear();
  if (scrapeWinId) {
    chrome.windows.remove(scrapeWinId, function() {});
    scrapeWinId = null;
  }
}

// ── NOTIFY DASHBOARD TABS ─────────────────────────────────────────────────
function notifyDashboard(msg) {
  // Match BOTH the live GitHub Pages dashboard AND the local server.js
  // dashboard (http://localhost:4321) — testing locally was silently
  // getting zero progress updates before this fix, since only the
  // github.io pattern was matched.
  var sent = false;
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(t) {
      if (!t.url) return;
      var isDashboard =
        t.url.indexOf('https://davidbard1226.github.io/makro-buybox-pro') === 0 ||
        t.url.indexOf('http://localhost:4321') === 0 ||
        t.url.indexOf('http://127.0.0.1:4321') === 0;
      if (!isDashboard) return;
      chrome.tabs.sendMessage(t.id, msg, function() {
        if (chrome.runtime.lastError) {
          console.warn('[BuyBox] notifyDashboard delivery failed for tab ' + t.id + ': ' + chrome.runtime.lastError.message);
        } else {
          sent = true;
        }
      });
    });
    // Fallback: if direct message failed or no dashboard tab found,
    // ensure data is in chrome.storage.local so bridge.js syncs it
    if (!sent && msg.data && msg.action === 'scrape_done') {
      console.log('[BuyBox] No dashboard tab reachable — saving scrape data to storage for bridge pickup');
      chrome.storage.local.get(['buybox_products'], function(r) {
        var products = r.buybox_products || [];
        var d = msg.data;
        if (d && d.url) {
          var idx = products.findIndex(function(p) { return p.url === d.url; });
          if (idx >= 0) products[idx] = Object.assign({}, products[idx], d);
          else products.push(d);
          chrome.storage.local.set({ buybox_products: products });
        }
      });
    }
  });
}

// ── CLEAN UP if scrape window closed manually ─────────────────────────────
chrome.windows.onRemoved.addListener(function(winId) {
  if (winId === scrapeWinId) {
    scrapeWinId = null;
    activeTabs.clear();
    if (active) {
      active = false;
      queue  = [];
      notifyDashboard({ action: 'queue_aborted', done: doneCount, total: totalUrls });
    }
  }
});
