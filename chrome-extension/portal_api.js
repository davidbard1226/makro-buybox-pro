// portal_api.js v1 — Makro Seller Portal API bridge (read-only pulls)
// Runs on seller.makro.co.za. Captures session auth (FK-CSRF-TOKEN from the
// app's own requests, X-LOCATION-ID + sellerId from localStorage.__appData)
// and exposes two read-only pulls to the dashboard via chrome.runtime:
//   portal_get_orders   → napi/my-orders/state-counts + napi/my-orders/fetch
//   portal_get_listings → napi/listing/listingsDataForStates + listingsStockCount
// No mutations — this file never writes to the portal.

(function() {
  'use strict';

  if (!window.location.hostname.includes('seller.makro.co.za') &&
      !window.location.hostname.includes('makromarketplace')) return;

  // Guard against double injection (content script + on-demand executeScript).
  if (window.__bbpPortalApiLoaded) return;
  window.__bbpPortalApiLoaded = true;

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
  // Status keys verified live: shipments_to_pack, shipments_processing_orders,
  // shipments_in_transit, shipments_delivered (with dispatch_after_date),
  // shipments_upcoming (WITHOUT dispatch_after_date — it 400s with it).
  async function fetchOrders() {
    const auth = readAppData();
    const sellerId = auth.sellerId;
    const counts = await napi('/napi/my-orders/state-counts?state=seller_easyship&serviceProfile=seller-fulfilled&sellerId=' + sellerId);

    const statuses = [
      { status: 'shipments_processing_orders', label: 'Order Processing' },
      { status: 'shipments_to_pack',           label: 'Pending Labels' },
      { status: 'shipments_in_transit',        label: 'In Transit' },
      { status: 'shipments_delivered',         label: 'Completed' },
      { status: 'shipments_upcoming',          label: 'Upcoming', noDate: true }
    ];

    const allItems = [];
    for (const s of statuses) {
      let page = 1, hasMore = true, guard = 0;
      while (hasMore && guard < 25) {
        guard++;
        const payload = {
          pagination: { page_num: page, page_size: 30 },
          params: { seller_id: sellerId },
          sort: [
            { field: 'dispatch_by_date', order: 'asc' },
            { field: 'dispatch_service_tier', order: 'asc' },
            { field: 'product.id', order: 'asc' }
          ]
        };
        if (!s.noDate) payload.params.dispatch_after_date = { to: new Date().toISOString() };
        const body = { status: s.status, payload: payload, sellerId: sellerId };
        try {
          const j = await napi('/napi/my-orders/fetch?sellerId=' + sellerId, { method: 'POST', body: body });
          const items = j.items || [];
          items.forEach(function(it) { it.__bbpStatusLabel = s.label; });
          allItems.push.apply(allItems, items);
          hasMore = !!j.has_more;
          page++;
        } catch(e) {
          // Fallback: retry once without the date param (some statuses reject it)
          if (!s.noDate) {
            try {
              const payload2 = {
                pagination: { page_num: page, page_size: 30 },
                params: { seller_id: sellerId },
                sort: [{ field: 'dispatch_by_date', order: 'asc' }]
              };
              const j2 = await napi('/napi/my-orders/fetch?sellerId=' + sellerId, {
                method: 'POST', body: { status: s.status, payload: payload2, sellerId: sellerId }
              });
              const items2 = j2.items || [];
              items2.forEach(function(it) { it.__bbpStatusLabel = s.label; });
              allItems.push.apply(allItems, items2);
              hasMore = !!j2.has_more;
              page++;
            } catch(e2) { hasMore = false; }
          } else { hasMore = false; }
        }
      }
    }
    return { orders: allItems, counts: (counts && counts.counts) || {} };
  }

  // ── LISTINGS PULL ─────────────────────────────────────────────────────────
  async function fetchListings() {
    const states = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
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

  // ── MESSAGE HANDLER ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
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
  });

  console.log('[BBP Portal API] Ready on ' + window.location.hostname);
})();