// portal_api.js v2 — Makro Seller Portal API bridge (read-only pulls + latch-on listing)
// Runs on seller.makro.co.za. Captures session auth (FK-CSRF-TOKEN from the
// app's own requests, X-LOCATION-ID + sellerId from localStorage.__appData)
// and exposes pulls + the latch-on listing write to the dashboard via chrome.runtime:
//   portal_get_orders    → napi/my-orders/state-counts + napi/my-orders/fetch
//   portal_get_listings  → napi/listing/listingsDataForStates + listingsStockCount
//   portal_list_product  → napi/listing/create-update-listings (latch-on, WRITE)
// The write path is inert until the dashboard explicitly sends a listing request
// with a confirmed payload (dryRun mode returns the payload without calling).

(function() {
  'use strict';

  if (!window.location.hostname.includes('seller.makro.co.za') &&
      !window.location.hostname.includes('makromarketplace')) return;

  // Guard against double injection (content script + on-demand executeScript).
  if (window.__bbpPortalApiLoaded) return;
  window.__bbpPortalApiLoaded = true;

  // If the extension was reloaded, previously-injected scripts are orphaned
  // (chrome.* APIs become undefined) — exit cleanly instead of throwing.
  if (!chrome.runtime || !chrome.runtime.id) return;

  const SELLER_HOST = 'https://seller.makro.co.za';

  // ── AUTH CAPTURE ──────────────────────────────────────────────────────────
  // X-LOCATION-ID + sellerId + csrfToken all live in localStorage.__appData
  // (verified live: sellerConfig.csrfToken, sellerConfig.sellerId, X-LOCATION-ID).
  function readAppData() {
    try {
      const raw = localStorage.getItem('__appData');
      if (!raw) return {};
      const d = JSON.parse(raw);
      return {
        locationId: d['X-LOCATION-ID'] || '',
        sellerId:   (d.sellerConfig && d.sellerConfig.sellerId) || '',
        csrfToken:  (d.sellerConfig && d.sellerConfig.csrfToken) || ''
      };
    } catch(e) { return {}; }
  }

  function getCsrf() { return readAppData().csrfToken; }

  // If no token yet (e.g. page still booting), poll briefly — the SPA writes
  // __appData on login, so a logged-in portal tab always has it.
  function ensureAuth() {
    return new Promise(function(resolve) {
      if (getCsrf()) { resolve(true); return; }
      let tries = 0;
      const t = setInterval(function() {
        tries++;
        if (getCsrf()) { clearInterval(t); resolve(true); }
        else if (tries > 40) { clearInterval(t); resolve(false); }
      }, 500);
    });
  }

  // ── NAPI HELPER ───────────────────────────────────────────────────────────
  function napi(path, opts) {
    opts = opts || {};
    const auth = readAppData();
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'FK-CSRF-TOKEN': getCsrf(),
      'X-LOCATION-ID': auth.locationId,
      'x-seller-id': auth.sellerId,
      'X-Requested-With': 'XMLHttpRequest'
    }, opts.headers || {});
    return fetch(SELLER_HOST + path, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ── ORDERS PULL ───────────────────────────────────────────────────────────
  // Per-status params match the portal's own fetch builders (verified live in
  // orders.814ec4c734db2cd7e876.js `la` map):
  //   to_pack / processing_orders → dispatch_after_date:{to: now}
  //   in_transit                 → status:{picked_up,dispatched,shipped:"true"}
  //   delivered                  → no default date
  //   upcoming                   → on_hold+upcoming flags, dispatch_after_date:{from: now}
  async function fetchOrders() {
    const auth = readAppData();
    const sellerId = auth.sellerId;
    const counts = await napi('/napi/my-orders/state-counts?state=seller_easyship&serviceProfile=seller-fulfilled&sellerId=' + sellerId);

    const now = new Date().toISOString();
    const statuses = [
      { status: 'shipments_processing_orders', label: 'Order Processing', params: { dispatch_after_date: { to: now } } },
      { status: 'shipments_to_pack',           label: 'Pending Labels',   params: { dispatch_after_date: { to: now } } },
      { status: 'shipments_in_transit',        label: 'In Transit',       params: { status: { picked_up: 'true', dispatched: 'true', shipped: 'true' } } },
      { status: 'shipments_delivered',         label: 'Completed',        params: {} },
      { status: 'shipments_upcoming',          label: 'Upcoming',         params: { on_hold: true, upcoming: true, dispatch_after_date: { from: now } } }
    ];

    const allItems = [];
    for (const s of statuses) {
      let page = 1, hasMore = true, guard = 0;
      while (hasMore && guard < 25) {
        guard++;
        const payload = {
          pagination: { page_num: page, page_size: 30 },
          params: Object.assign({ seller_id: sellerId }, s.params),
          sort: [
            { field: 'dispatch_by_date', order: 'asc' },
            { field: 'dispatch_service_tier', order: 'asc' },
            { field: 'product.id', order: 'asc' }
          ]
        };
        const body = { status: s.status, payload: payload, sellerId: sellerId };
        try {
          const j = await napi('/napi/my-orders/fetch?sellerId=' + sellerId, { method: 'POST', body: body });
          const items = j.items || [];
          items.forEach(function(it) { it.__bbpStatusLabel = s.label; });
          allItems.push.apply(allItems, items);
          hasMore = !!j.has_more;
          page++;
        } catch(e) {
          // Skip this status rather than aborting the whole pull.
          hasMore = false;
        }
      }
    }
    return { orders: allItems, counts: (counts && counts.counts) || {} };
  }

  // ── LISTINGS PULL ─────────────────────────────────────────────────────────
  // Only ACTIVE listings are pulled — the seller works with active products
  // only (INACTIVE/BLOCKED are not used; BLOCKED also 400s on this endpoint).
  async function fetchListings() {
    const states = ['ACTIVE'];
    const all = [];
    const counts = {};
    for (const st of states) {
      let batch = 0, guard = 0;
      while (guard < 60) {
        guard++;
        const j = await napi('/napi/listing/listingsDataForStates', {
          method: 'POST',
          body: {
            search_text: '',
            search_filters: { internal_state: st },
            column: {
              sort: { column_name: 'demand_weight', sort_by: 'DESC' },
              pagination: { batch_no: batch, batch_size: 100 }
            }
          }
        });
        counts[st] = j.count;
        const items = j.listing_data_response || [];
        items.forEach(function(l) { l.__bbpState = st; });
        all.push.apply(all, items);
        if (items.length < 100) break;
        batch++;
      }
    }

    // Stock: POST body is an ARRAY of {listing_id, service_profile} (verified).
    // Response: {listing_id: {profile: [{quantity, reserved, locationId}]}}
    const stockMap = {};
    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100).map(function(l) {
        return { listing_id: l.listing_id, service_profile: l.service_profile || 'NON_FBF' };
      });
      try {
        const sj = await napi('/napi/listing/listingsStockCount', { method: 'POST', body: batch });
        Object.keys(sj).forEach(function(lid) {
          const prof = sj[lid];
          const key = Object.keys(prof)[0];
          const arr = prof[key] || [];
          stockMap[lid] = arr.length ? (arr[0].quantity || 0) : 0;
        });
      } catch(e) { /* stock is best-effort */ }
    }
    return { listings: all, counts: counts, stockMap: stockMap };
  }

  // ── LATCH-ON PRODUCT LOOKUP (READ-ONLY) ───────────────────────────────────
  // Given an FSN, asks the portal what catalog product you'd be listing against
  // (the "Search by Brand, FSN, Product URL" step of the latch-on flow).
  // Endpoint + payload verified from the portal's own bundle (chunk_497.js):
  //   POST napi/listing/listing-price-recommendation
  //   body: { request: { filter_by: [{filter_type:"TEXT_MATCH",
  //                                   field_name:"product_id", values:[FSN]}],
  //                      order_by:[], group_by:[], page_number:0, page_size:1,
  //                      "x-feature-id":"all_markets_feature" },
  //           viewId: "pr.insight_listing_latchon_search_view_v2" }
  // Read-only — never mutates the portal.
  async function lookupProduct(fsn) {
    const f = String(fsn || '').trim().toUpperCase();
    if (!f) throw new Error('FSN is required');
    const j = await napi('/napi/listing/listing-price-recommendation', {
      method: 'POST',
      body: {
        request: {
          filter_by: [{ filter_type: 'TEXT_MATCH', field_name: 'product_id', values: [f] }],
          order_by: [],
          group_by: [],
          page_number: 0,
          page_size: 1,
          'x-feature-id': 'all_markets_feature'
        },
        viewId: 'pr.insight_listing_latchon_search_view_v2'
      }
    });
    return j;
  }

  // ── LATCH-ON LISTING (WRITE) ──────────────────────────────────────────────
  // Lists a product that already exists on the Makro catalog (you have the FSN)
  // but that you don't yet sell. Mirrors the portal's own "START SELLING" flow:
  //   POST napi/listing/create-update-listings  with sourceid: "ui.latch-on"
  // Payload shape verified live (2026-08-15) in docs/seller-portal-api-feasibility.md:
  //   { bulkRequests: [{ attributeValues: {sku_id, mrp, flipkart_selling_price, ...},
  //                      context: {ignore_warnings: false},
  //                      productId: <FSN>, skuId: <SKU>, packages: [...] }] }
  // dryRun=true returns the exact payload without calling the portal.
  async function listProduct(req) {
    const auth = readAppData();
    const sellerId = auth.sellerId;

    // Required selling info (mirrors the START SELLING form fields).
    const skuId        = String(req.skuId || '').trim();
    const mrp          = Number(req.mrp);
    const sellingPrice = Number(req.sellingPrice);
    const fsn          = String(req.fsn || '').trim().toUpperCase();
    const listingState = req.listingState === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const serviceProfile = req.serviceProfile === 'FBS' ? 'FBS' : 'NON_FBF';
    const pickPackSla  = Number(req.pickPackSla) || 2;
    const dims         = req.dimensions || {};

    if (!fsn) throw new Error('FSN is required');
    if (!skuId) throw new Error('SKU ID is required');
    if (!(mrp > 0)) throw new Error('Base price (MRP) must be > 0');
    if (!(sellingPrice > 0)) throw new Error('Selling price must be > 0');

    const packages = [{
      package_length: Number(dims.length) || 0,
      package_breadth: Number(dims.breadth) || 0,
      package_height: Number(dims.height) || 0,
      package_weight: Number(dims.weight) || 0
    }];

    const attributeValues = {
      sku_id: skuId,
      mrp: mrp,
      flipkart_selling_price: sellingPrice,
      listing_status: listingState,
      service_profile: serviceProfile,
      pick_pack_sla: pickPackSla
    };

    const bulkRequests = [{
      attributeValues: attributeValues,
      context: { ignore_warnings: false },
      productId: fsn,
      skuId: skuId,
      packages: packages
    }];

    const payload = { bulkRequests: bulkRequests };

    if (req.dryRun) {
      return { dryRun: true, payload: payload, sellerId: sellerId };
    }

    const j = await napi('/napi/listing/create-update-listings', {
      method: 'POST',
      headers: { sourceid: 'ui.latch-on' },
      body: payload
    });
    return { dryRun: false, result: j };
  }

  // ── DIRECT PRICE UPDATE (THE REAL ENDPOINT) ─────────────────────────────
  // This is the exact API the portal uses when you click Edit → Change Price → Save.
  // Verified from live cURL capture (2026-08-30):
  //   POST napi/listing/updateSellingPrice?warningConfirmed=false&userName=...
  //   Body: { listingUpdate: { <SKU>: { product_id: <FSN>, price: { mrp, selling_price, currency: "INR" } } },
  //           priceRecoUpdate: {} }
  async function updatePrice(req) {
    const auth = readAppData();
    const sellerId = auth.sellerId;
    const userName = req.userName || 'Bonolo Online';

    const skuId  = String(req.skuId || '').trim();
    const fsn    = String(req.fsn || '').trim().toUpperCase();
    const mrp    = Number(req.mrp);
    const price  = Number(req.sellingPrice);

    if (!skuId) throw new Error('SKU ID is required');
    if (!fsn) throw new Error('FSN (product_id) is required');
    if (!(mrp > 0)) throw new Error('MRP must be > 0');
    if (!(price > 0)) throw new Error('Selling price must be > 0');

    const payload = {
      listingUpdate: {},
      priceRecoUpdate: {}
    };
    payload.listingUpdate[skuId] = {
      product_id: fsn,
      price: {
        mrp: mrp,
        selling_price: price,
        currency: 'INR'
      }
    };

    const qs = 'warningConfirmed=false&userName=' + encodeURIComponent(userName);
    const j = await napi('/napi/listing/updateSellingPrice?' + qs, {
      method: 'POST',
      body: payload
    });
    return { result: j, skuId: skuId, fsn: fsn, price: price };
  }

  // ── SESSION VERIFICATION ─────────────────────────────────────────────────
  // A logged-out portal tab still has stale tokens in localStorage.__appData
  // and stale cookies in document.cookie — capturing them "succeeds" but saves
  // dead auth, so every push then dies with SESSION EXPIRED. Verify the session
  // is actually alive with one lightweight authenticated call before saving.
  function verifySession() {
    const auth = readAppData();
    if (!auth.csrfToken || !auth.sellerId) return Promise.resolve(false);
    return napi('/napi/my-orders/state-counts?state=seller_easyship&serviceProfile=seller-fulfilled&sellerId=' + auth.sellerId)
      .then(function() { return true; })
      .catch(function() { return false; });
  }

  // ── MESSAGE HANDLER ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'portal_refresh_session') {
      // Capture fresh session auth from this logged-in portal tab
      var auth = readAppData();
      var cookies = '';
      try { cookies = document.cookie || ''; } catch(e) {}
      if (!auth.csrfToken || !cookies) {
        sendResponse({ ok: false, error: 'Could not capture session — reload the portal page and try again.' });
        return;
      }
      // Only save cookies if the session is actually alive — a logged-out tab
      // would otherwise save dead auth and every push would hit SESSION EXPIRED.
      verifySession().then(function(alive) {
        if (!alive) {
          sendResponse({ ok: false, error: 'portal_session_expired — log into seller.makro.co.za and try again.' });
          return;
        }
        sendResponse({ ok: true, csrfToken: auth.csrfToken, sellerId: auth.sellerId, locationId: auth.locationId, cookies: cookies });
      });
      return true; // async
    }

    if (msg.action === 'portal_get_orders') {
      ensureAuth().then(function(ok) {
        if (!ok) {
          sendResponse({ ok: false, error: 'Could not capture session token — reload the portal page and try again.' });
          return;
        }
        fetchOrders().then(function(res) {
          sendResponse({ ok: true, orders: res.orders, counts: res.counts });
        }).catch(function(e) {
          sendResponse({ ok: false, error: e.message });
        });
      });
      return true; // async
    }

    if (msg.action === 'portal_get_listings') {
      ensureAuth().then(function(ok) {
        if (!ok) {
          sendResponse({ ok: false, error: 'Could not capture session token — reload the portal page and try again.' });
          return;
        }
        fetchListings().then(function(res) {
          sendResponse({ ok: true, listings: res.listings, counts: res.counts, stockMap: res.stockMap });
        }).catch(function(e) {
          sendResponse({ ok: false, error: e.message });
        });
      });
      return true; // async
    }
  if (msg.action === 'portal_lookup_product') {
      ensureAuth().then(function(ok) {
        if (!ok) {
          sendResponse({ ok: false, error: 'Could not capture session token — reload the portal page and try again.' });
          return;
        }
        lookupProduct(msg.fsn || '').then(function(res) {
          sendResponse({ ok: true, data: res });
        }).catch(function(e) {
          sendResponse({ ok: false, error: e.message });
        });
      });
      return true; // async
    }
    if (msg.action === 'portal_list_product') {
    ensureAuth().then(function(ok) {
      if (!ok) {
        sendResponse({ ok: false, error: 'Could not capture session token — reload the portal page and try again.' });
        return;
      }
      listProduct(msg.req || {}).then(function(res) {
        sendResponse({ ok: true, dryRun: res.dryRun, payload: res.payload, result: res.result, sellerId: res.sellerId });
      }).catch(function(e) {
        sendResponse({ ok: false, error: e.message });
      });
    });
    return true; // async
  }

  // ── SINGLE-PRODUCT PRICE PUSH ───────────────────────────────────────────
  // Updates the selling price for ONE product using the real portal endpoint.
  // msg.req = { fsn, skuId, sellingPrice, mrp?, userName? }
  if (msg.action === 'portal_update_price') {
    ensureAuth().then(function(ok) {
      if (!ok) {
        sendResponse({ ok: false, error: 'Could not capture session token — reload the portal page and try again.' });
        return;
      }
      updatePrice(msg.req || {}).then(function(res) {
        sendResponse({ ok: true, result: res.result, skuId: res.skuId, fsn: res.fsn, price: res.price });
      }).catch(function(e) {
        sendResponse({ ok: false, error: e.message });
      });
    });
    return true; // async
  }

  // ── BATCH PRICE PUSH ────────────────────────────────────────────────────
  // Updates prices for multiple products sequentially (1 at a time to avoid
  // rate limits). msg.items = [{ fsn, skuId, sellingPrice, mrp? }, ...]
  if (msg.action === 'portal_batch_update_prices') {
    ensureAuth().then(function(ok) {
      if (!ok) {
        sendResponse({ ok: false, error: 'Could not capture session token — reload the portal page and try again.' });
        return;
      }
      var items = msg.items || [];
      var results = [];
      var idx = 0;
      function nextItem() {
        if (idx >= items.length) {
          sendResponse({ ok: true, results: results, total: items.length });
          return;
        }
        var item = items[idx];
        idx++;
        updatePrice(item).then(function(res) {
          results.push({ fsn: item.fsn, ok: true, result: res.result });
          setTimeout(nextItem, 500);
        }).catch(function(e) {
          results.push({ fsn: item.fsn, ok: false, error: e.message });
          setTimeout(nextItem, 500);
        });
      }
      nextItem();
    });
    return true; // async
  }
});
})();