// content.js v4 — Makro BuyBox Pro
// Robust seller name extraction + correct price selector

(function() {
  'use strict';

  // If the extension was reloaded, previously-injected scripts are orphaned
  // (chrome.* APIs become undefined) — exit cleanly instead of throwing.
  if (!chrome.runtime || !chrome.runtime.id) return;

  // Set by 'fasttrack_api_stop' — the batch worker loop checks it between
  // fetches and finalizes early with partial results.
  var fastTrackStopRequested = false;

  // ── PRICE EXTRACTOR ───────────────────────────────────────────────────────
  function extractPrice(text) {
    if (!text) return null;

    // Normalise: strip currency symbol and whitespace
    const t = text.replace(/R\s*/gi, '').trim();

    // Case 1: "1,095.00" — comma=thousands, dot=decimal  e.g. R 1,095.00
    const m1 = t.match(/^([\d]{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/);
    if (m1) {
      const val = parseFloat(m1[0].replace(/,/g, ''));
      if (val > 0) return val;
    }

    // Case 2: "1 095.00" or "1 095,00" — space=thousands
    const m2 = t.match(/^([\d]{1,3}(?:\s\d{3})+)(?:[.,]\d{1,2})?$/);
    if (m2) {
      const val = parseFloat(m2[0].replace(/\s/g, '').replace(',', '.'));
      if (val > 0) return val;
    }

    // Case 3: plain number with dot decimal "1095.00"
    const m3 = t.match(/^(\d+)(?:\.\d{1,2})?$/);
    if (m3) {
      const val = parseFloat(m3[0]);
      if (val > 0) return val;
    }

    // Case 4: "1095,00" — dot=thousands OR comma=decimal (ZAR edge case)
    // If digits before comma > 3 chars, comma is thousands separator
    const m4 = t.match(/^(\d+),(\d{2})$/);
    if (m4) {
      const before = m4[1], after = m4[2];
      if (before.length >= 4) {
        // e.g. "1095,00" → 1095.00
        return parseFloat(before + '.' + after);
      } else {
        // e.g. "1,09" → likely "1,095" truncated — skip, too small
        return null;
      }
    }

    return null;
  }

  // ── SELLER EXTRACTOR ──────────────────────────────────────────────────────
  function extractSeller() {
    // Strategy 1: look for elements with "sold by" or "seller" in text
    const allEls = document.querySelectorAll('a, span, div, p');
    for (const el of allEls) {
      if (el.children.length > 3) continue;
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt.length < 3 || txt.length > 200) continue;

      // Pattern: "Sold by XYZ" in a single element
      const m1 = txt.match(/^[Ss]old\s+[Bb]y\s+(.+)$/);
      if (m1) return m1[1].trim();

      // Pattern: "by XYZ" after checking parent says "Sold"
      const parentTxt = (el.parentElement?.innerText || '').trim();
      if (/sold\s+by/i.test(parentTxt)) {
        const m2 = parentTxt.match(/[Ss]old\s+[Bb]y\s+([^\n\r.,(]{2,60})/);
        if (m2) return m2[1].trim();
      }
    }

    // Strategy 2: full body text scan
    const bodyText = document.body.innerText || '';
    const patterns = [
      /[Ss]old\s+[Bb]y[:\s]+([^\n\r,.(]{2,60})/,
      /[Ss]eller[:\s]+([^\n\r,.(]{2,60})/,
      /[Ff]ulfilled?\s+[Bb]y[:\s]+([^\n\r,.(]{2,60})/,
      /[Ss]hips?\s+[Ff]rom[:\s]+([^\n\r,.(]{2,60})/,
      /[Mm]arketplace\s+[Ss]eller[:\s]+([^\n\r,.(]{2,60})/,
    ];
    for (const pat of patterns) {
      const m = bodyText.match(pat);
      if (m) {
        const candidate = m[1].trim().split('\n')[0].trim();
        if (candidate.length > 1 && candidate.length < 80) return candidate;
      }
    }

    // Strategy 3: look for class names with "seller" in them
    const sellerEls = document.querySelectorAll(
      '[class*="seller"],[class*="Seller"],[class*="sold"],[class*="Sold"],' +
      '[data-testid*="seller"],[data-qa*="seller"]'
    );
    for (const el of sellerEls) {
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt.length > 1 && txt.length < 80 && !/sold by/i.test(txt)) return txt;
      const m = txt.match(/[Ss]old\s+[Bb]y\s+(.+)/);
      if (m) return m[1].trim();
    }

    return null;
  }

  // ── API-BASED SELLER/PRICE EXTRACTION (v5) ───────────────────────────────
  // Replaces fragile CSS-class DOM scraping with Makro's own internal API.
  // Same endpoint the sellers page itself uses — one call gets BOTH the
  // buybox winner AND the full seller list, no need to visit /sellers?pid=.
  function fetchSellersApi(pid) {
    console.log('[BuyBox v5] Calling sellers API for PID:', pid);
    return fetch('/fccng/api/3/page/dynamic/product-sellers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-agent': navigator.userAgent + ' FKUA/website/42/website/Desktop'
      },
      credentials: 'include',
      body: JSON.stringify({ requestContext: { productId: pid }, locationContext: {} })
    })
      .then(function(r) {
        console.log('[BuyBox v5] Sellers API response:', r.status, r.ok);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(json) {
        var sellers = parseSellersJson(json);
        console.log('[BuyBox v5] Parsed sellers:', sellers.length, sellers.map(function(s) { return s.seller + ' R' + s.price + (s.selected ? ' ★' : ''); }));
        return sellers;
      })
      .catch(function(e) { console.warn('[BuyBox v5] Sellers API failed:', e.message); return null; });
  }

  function parseSellersJson(data) {
    var results = [];
    (function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === 'object') {
        if (
          node.sellerInfo && node.sellerInfo.value && node.sellerInfo.value.name &&
          node.pricing && node.pricing.value && node.pricing.value.finalPrice &&
          typeof node.pricing.value.finalPrice.value === 'number'
        ) {
          results.push({
            seller: node.sellerInfo.value.name.trim(),
            sellerId: node.sellerInfo.value.id,
            price: node.pricing.value.finalPrice.value,
            mrp: node.pricing.value.mrp ? node.pricing.value.mrp.value : null,
            selected: !!node.selected
          });
        }
        for (var k in node) walk(node[k]);
      }
    })(data);
    var seen = {};
    var unique = results.filter(function(r) {
      if (seen[r.sellerId]) return false;
      seen[r.sellerId] = true;
      return true;
    });
    unique.sort(function(a, b) { return a.price - b.price; });
    return unique;
  }

  // ── MAIN SCRAPE ────────────────────────────────────────────────────────────
  function scrapeProduct() {
    return scrapeProductDom().then(function(data) {
      console.log('[BuyBox v5] DOM result:', data.buyBoxPrice, data.buyBoxSeller, 'fsn:', data.fsn);
      // If no real FSN from DOM, try the sellers URL pid as a last resort
      if (!data.fsn && data.sellersUrl) {
        var pidM = data.sellersUrl.match(/[?&]pid=([A-Z0-9]{8,})/i);
        if (pidM && !/^itm/i.test(pidM[1])) {
          data.fsn = pidM[1].toUpperCase();
          console.log('[BuyBox v5] FSN from sellers URL:', data.fsn);
        }
      }
      if (!data.fsn) return data;
      return fetchSellersApi(data.fsn).then(function(sellers) {
        if (sellers && sellers.length) {
          // DIAGNOSTIC: dump the raw sellers so we can see the actual API data
          // (prices, mrp, selected) and why the buybox reads as the RRP.
          console.log('[BuyBox v5] RAW SELLERS:', JSON.stringify(sellers.map(function(s){
            return { seller: s.seller, price: s.price, mrp: s.mrp, selected: s.selected };
          })));
          // The buybox winner is ALWAYS the lowest-priced seller. The sellers
          // list is sorted ascending by price, so sellers[0] is the buybox.
          // (Preferring the API's `selected` flag was unreliable — it sometimes
          // pointed at a non-lowest seller, causing the buybox price to
          // fluctuate wildly between scrapes, e.g. R33396 vs R40000 for the
          // same product, which made the tool miss lowering opportunities.)
          var winner = sellers[0];
          console.log('[BuyBox v5] API override:', winner.seller, 'R' + winner.price, 'selected:', winner.selected);
          // Use the seller NAME from the API (for win/lose detection), but keep
          // the LOWEST price between the API and the DOM. The API's finalPrice
          // can be the RRP (e.g. R40000) instead of the real selling price
          // (e.g. R33959, "15% off"); the DOM lowest price is the true selling
          // price, so we never let the API push the buybox UP to the RRP.
          data.buyBoxSeller = winner.seller;
          if (data.buyBoxPrice > 0 && winner.price > 0) {
            data.buyBoxPrice = Math.min(data.buyBoxPrice, winner.price);
          } else if (winner.price > 0) {
            data.buyBoxPrice = winner.price;
          }
          data.hasBuyBox = true;
          data.sellers = sellers;
          data.sellersCount = sellers.length;
          data.sellersChecked = new Date().toISOString();
          data.dataSource = 'api';
        } else {
          console.log('[BuyBox v5] No sellers from API, using DOM fallback');
          data.dataSource = 'dom-fallback';
        }
        return data;
      });
    });
  }

  function scrapeProductDom() {
    return new Promise(function(resolve) {
    try {
      const data = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        sku: null,
        title: null,
        buyBoxPrice: null,
        buyBoxSeller: null,
        hasBuyBox: false,
        inStock: null,
        sellersUrl: null
      };

      // SKU from URL path (itm... part) — but NEVER store the itm... slug as a
      // SKU: it gets stripped by the dashboard later and leaves the product
      // without a SKU (no cost → autoReprice skips → prices go stale). Real
      // SKUs are stamped from the imported S_listing by FSN match instead.
      const skuMatch = window.location.pathname.match(/\/p\/([^/?#]+)/);
      if (skuMatch && !/^itm/i.test(skuMatch[1])) data.sku = skuMatch[1];

      // FSN — try multiple sources in priority order
      // 1. pid= query param (present when clicking from Google ads)
      const fsnFromPid = window.location.search.match(/[?&]pid=([A-Z0-9]{8,})/i);
      if (fsnFromPid) data.fsn = fsnFromPid[1].toUpperCase();

      // 2. JSON-LD structured data on page (most reliable when pid not in URL)
      if (!data.fsn) {
        const jsonlds = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of jsonlds) {
          try {
            const j = JSON.parse(s.textContent);
            const mp = j.mpn || j.sku || (j.offers && j.offers.mpn) || '';
            // FSNs are uppercase alphanumeric, 12-20 chars
            if (/^[A-Z0-9]{10,20}$/.test(mp)) { data.fsn = mp; break; }
          } catch(e) {}
        }
      }

      // 3. Sellers link — the /sellers?pid=XXXX URL carries the REAL FSN (pid).
      //    This is the most reliable source on the product page and is checked
      //    before the data-* attributes (which often hold the itm... slug).
      if (!data.fsn) {
        var sl = document.querySelector('a[href*="/sellers?pid="]') ||
                 document.querySelector('a[href*="sellers"][href*="pid="]') ||
                 document.querySelector('[class*="seller"][href*="pid"]');
        if (sl) {
          var pidM = sl.href.match(/[?&]pid=([A-Z0-9]{8,})/i);
          if (pidM && !/^itm/i.test(pidM[1])) data.fsn = pidM[1].toUpperCase();
        }
      }

      // 4. data-* attributes on product container
      // NOTE: data-item-id often holds the itm... URL slug, NOT the real FSN.
      // Real FSNs are uppercase alphanumeric (e.g. PRNH5YM8QETSKU8D). We must
      // reject itm... slugs here or the product gets a bogus FSN and loses its
      // cost match (no cost → autoReprice skips → prices go stale).
      if (!data.fsn) {
        const el = document.querySelector('[data-fsn],[data-pid],[data-product-id],[data-item-id]');
        if (el) {
          const val = (el.dataset.fsn || el.dataset.pid || el.dataset.productId || el.dataset.itemId || '').trim();
          if (/^[A-Z0-9]{8,}$/i.test(val) && !/^itm/i.test(val)) data.fsn = val.toUpperCase();
        }
      }

      // 4. Canonical URL sometimes has FSN embedded differently
      if (!data.fsn) {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
          const m = canonical.href.match(/[?&]pid=([A-Z0-9]{8,})/i);
          if (m && !/^itm/i.test(m[1])) data.fsn = m[1].toUpperCase();
        }
      }

      // 5. Search page body text for FSN-like patterns near product identifier labels
      if (!data.fsn) {
        const bodyHtml = document.body.innerHTML || '';
        const m = bodyHtml.match(/"fsn"\s*:\s*"([A-Z0-9]{10,20})"/i) ||
                  bodyHtml.match(/"productId"\s*:\s*"([A-Z0-9]{10,20})"/i) ||
                  bodyHtml.match(/fsn[=:]["']([A-Z0-9]{10,20})/i);
        if (m) data.fsn = m[1].toUpperCase();
      }

      // Title
      const h1 = document.querySelector('h1');
      if (h1) data.title = h1.innerText.trim();
      if (!data.title) data.title = document.title.replace(/\s*[-|].*$/,'').trim();

      // ── PRICE: always take the LOWEST price on the page ─────────────────
      // The RRP (list price, e.g. R40000) is always HIGHER than the real
      // selling price (e.g. R33959, "15% off"). The buybox is the lowest price,
      // so we must use the minimum of ALL price-like elements — never trust a
      // single selector that might grab the RRP instead of the selling price.
      const candidates = [];
      // Exact selector (may hold the selling price OR the RRP — include it)
      const exactEl = document.querySelector('div.Xaaq-1._16Jk6d');
      if (exactEl) {
        const p = extractPrice(exactEl.innerText);
        if (p && p > 10) candidates.push(p);
      }
      // Scan all price-looking elements, collect every plausible price.
      // IMPORTANT: the selling price is often bundled with extra text like
      // "R 33,959.00\n15% off\nKorvex" — extractPrice() requires the WHOLE
      // string to be a price, so it rejects the selling price and only the
      // clean standalone RRP (R 40,000.00) matches. Instead of requiring a
      // full-string match, we pull EVERY "R <amount>" out of the text and add
      // each as a candidate, then take the minimum. This guarantees the real
      // selling price (R33,959) is never missed just because it sits next to
      // "15% off" or a seller name.
      document.querySelectorAll('[class*="Xaaq"],[class*="price"],[class*="Price"],[class*="amount"],[class*="cost"],[class*="dyC4"],[class*="CEmi"]').forEach(el => {
        if (el.children.length > 2) return;
        const txt = (el.innerText || '').trim();
        if (!/R\s*[\d,. ]+/i.test(txt)) return;
        // Find every "R <amount>" in the text (handles "R 33,959.00 15% off")
        const priceMatches = txt.match(/R\s*[\d][\d,. ]*/gi) || [];
        for (const pm of priceMatches) {
          const p = extractPrice(pm);
          if (p && p > 10) candidates.push(p); // ignore implausibly small values
        }
      });
      if (candidates.length) data.buyBoxPrice = Math.min(...candidates);
      // DIAGNOSTIC: show every price candidate found on the page so we can see
      // whether the RRP (R40000) is the only price present or the selling price
      // (R33959) is being missed by the selectors.
      console.log('[BuyBox v5] DOM PRICE CANDIDATES:', JSON.stringify(candidates), '→ buyBoxPrice:', data.buyBoxPrice);

      // ── SELLER ────────────────────────────────────────────────────────────
      const seller = extractSeller();
      if (seller) {
        data.buyBoxSeller = seller;
        data.hasBuyBox = true;
      }

      // Sellers URL (link to page with all sellers for this product)
      var sellersLink = document.querySelector('a[href*="/sellers?pid="]');
      if (!sellersLink) sellersLink = document.querySelector('a[href*="sellers"][href*="pid="]');
      if (!sellersLink) sellersLink = document.querySelector('[class*="seller"][href*="pid"]');
      if (!sellersLink) sellersLink = document.querySelector('a[href*="sellers"]');
      if (sellersLink) data.sellersUrl = sellersLink.href;
      console.log('[BuyBox v4] Sellers link found:', sellersLink ? sellersLink.href : 'none');

      // Stock
      const body = document.body.innerText || '';
      if (/out of stock|unavailable|sold out/i.test(body)) data.inStock = false;
      else if (/add to cart|add to basket|buy now/i.test(body)) data.inStock = true;

      // Debug log so we can see what was found
      console.log('[BuyBox v4] Scraped:', {
        title: data.title,
        price: data.buyBoxPrice,
        seller: data.buyBoxSeller,
        sku: data.sku,
        url: data.url
      });

      resolve(data);
    } catch(e) {
      console.error('[BuyBox v4] Error:', e);
      resolve({ url: window.location.href, timestamp: new Date().toISOString(), error: e.message });
    }
    });
  }

  // ── SAVE TO STORAGE ────────────────────────────────────────────────────────
  function saveProduct(d) {
    if (!d || d.error) return;
    chrome.storage.local.get(['buybox_products'], function(r) {
      const products = r.buybox_products || [];
      const idx = products.findIndex(p => p.url === d.url);
      if (idx >= 0) products[idx] = Object.assign({}, products[idx], d);
      else products.push(d);
      if (products.length > 500) products.splice(0, products.length - 500);
      chrome.storage.local.set({ buybox_products: products });
    });
  }

  // ── SELLERS PAGE EXTRACTION ───────────────────────────────────────────────
  function isSellersPage() {
    return /\/sellers\?pid=/i.test(window.location.href);
  }

  function parseSellerPrice(s) {
    // Makro sellers page uses format: "8,270"+"00" or "8,27000" (comma=thousands, last 2 digits=cents)
    if (!s) return 0;
    var cleaned = s.replace(/,/g, '');
    if (cleaned.indexOf('.') >= 0) return parseFloat(cleaned);
    if (cleaned.length <= 2) return parseFloat(cleaned);
    if (/^\d{4,}$/.test(cleaned)) {
      return parseFloat(cleaned.slice(0, -2) + '.' + cleaned.slice(-2));
    }
    return parseFloat(cleaned);
  }

  function scrapeSellersPage() {
    return new Promise(function(resolve) {
      var maxWait = 15000;

      function tryExtract() {
        var sellers = [];

        // Exactly match the HTML the user provided:
        // Each seller row: <div class="_2Y3EWJ">
        //   Name: <div class="isp3v_ col-3-12"><div class="tWzK1p"><div class="_3enH42"><span>Name</span>
        //   Price: <span class="_8TW4TR">R 8,270</span><span class="_1rSsFO">00</span>
        var rows = document.querySelectorAll('div._2Y3EWJ');
        for (var i = 0; i < rows.length; i++) {
          var nameEl = rows[i].querySelector('span');
          var priceMain = rows[i].querySelector('span._8TW4TR');
          var priceCent = rows[i].querySelector('span._1rSsFO');
          if (!nameEl || !priceMain) continue;
          var name = nameEl.textContent.trim();
          var raw = priceMain.textContent.replace(/R\s*/g, '').trim();
          if (priceCent) raw += priceCent.textContent.trim();
          if (name && raw) sellers.push({ seller: name, price: parseSellerPrice(raw) });
        }
        return sellers;
      }

      var immediate = tryExtract();
      console.log('[BuyBox v4] Immediate extract:', immediate.length, JSON.stringify(immediate));
      if (immediate.length > 0) { resolve(immediate); return; }

      var attempts = 0;
      var observer = new MutationObserver(function() {
        var result = tryExtract();
        if (result.length > 0) { console.log('[BuyBox v4] Found via observer:', result.length); observer.disconnect(); resolve(result); }
        if (++attempts > 150) { observer.disconnect(); resolve(result); }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(function() {
        observer.disconnect();
        var final = tryExtract();
        console.log('[BuyBox v4] After timeout:', final.length, JSON.stringify(final));
        // Debug: dump page structure
        console.log('[BuyBox v4] _2Y3EWJ count:', document.querySelectorAll('div._2Y3EWJ').length);
        console.log('[BuyBox v4] _8TW4TR count:', document.querySelectorAll('span._8TW4TR').length);
        console.log('[BuyBox v4] _3enH42 count:', document.querySelectorAll('div._3enH42').length);
        console.log('[BuyBox v4] body children:', document.body.children.length, 'first child tag:', document.body.children[0] ? document.body.children[0].tagName : 'none');
        console.log('[BuyBox v4] body text (500):', (document.body.innerText || '').substring(0, 500));
        resolve(final);
      }, maxWait);
    });
  }

  // ── AUTO SCRAPE ────────────────────────────────────────────────────────────
  if (/\/p\/[A-Za-z0-9_]+/.test(window.location.pathname)) {
    const run = function() {
      scrapeProduct().then(function(d) {
        saveProduct(d);
        // Notify background so queue can advance to next URL
        try {
          chrome.runtime.sendMessage({ action: 'page_scraped', data: d });
        } catch(e) {}
      });
    };
    if (document.readyState === 'complete') setTimeout(run, 300);
    else window.addEventListener('load', function() { setTimeout(run, 500); });
  }

  // ── SELLERS PAGE AUTO-SCRAPE ───────────────────────────────────────────────
  if (isSellersPage()) {
    var sellersRun = function() {
      console.log('[BuyBox v4] Sellers page detected, scraping...');
      scrapeSellersPage().then(function(sellers) {
        console.log('[BuyBox v4] Sellers scraped:', sellers.length, 'results', sellers);
        if (sellers.length === 0) return;
        var fsn = (window.location.search.match(/[?&]pid=([A-Z0-9]{8,})/i) || [])[1];
        if (!fsn) { console.log('[BuyBox v4] No FSN in sellers URL'); return; }
        try {
          chrome.runtime.sendMessage({ action: 'sellers_scraped', fsn: fsn.toUpperCase(), sellers: sellers });
          console.log('[BuyBox v4] sellers_scraped sent for', fsn);
        } catch(e) { console.log('[BuyBox v4] Error sending sellers_scraped:', e); }
      });
    };
    if (document.readyState === 'complete') setTimeout(sellersRun, 500);
    else window.addEventListener('load', function() { setTimeout(sellersRun, 800); });
  }

  // ── MESSAGES ───────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'ping') { sendResponse({ pong: true }); return true; }
    if (msg.action === 'scrape_now' || msg.action === 'SCRAPE_URL') {
      scrapeProduct().then(function(d) {
        saveProduct(d);
        sendResponse({ success: true, data: d });
      });
      return true; // keep sendResponse channel open for async response
    }

    // ── FAST-TRACK API BATCH SCRAPE ─────────────────────────────────────────
    // Scrape MANY products by FSN via the sellers API from ONE page context —
    // no page loads, no tabs, no human delays. Each FSN is one lightweight
    // POST to /fccng/api/3/page/dynamic/product-sellers returning ALL sellers
    // (buybox winner + every competitor price). Progress is posted back to the
    // background as each result lands; a final 'fasttrack_api_done' carries the
    // full result array. Concurrency is capped at 8 to stay gentle on Makro.
    if (msg.action === 'fasttrack_api_stop') {
      fastTrackStopRequested = true;
      sendResponse({ ok: true });
      return true;
    }
    if (msg.action === 'fasttrack_api_scrape') {
      var fsns = msg.fsns || [];
      var concurrency = Math.min(Math.max(parseInt(msg.concurrency) || 6, 1), 8);
      var results = [];
      var done = 0;
      var idx = 0;
      var doneSent = false;
      fastTrackStopRequested = false;

      function worker() {
        if (fastTrackStopRequested || idx >= fsns.length) {
          // Stopped (or exhausted) — send done once with whatever we have so
          // the dashboard finalizes the cycle instead of hanging.
          if (!doneSent) {
            doneSent = true;
            chrome.runtime.sendMessage({
              action: 'fasttrack_api_done',
              results: results,
              stopped: fastTrackStopRequested
            });
          }
          return;
        }
        var myIdx = idx++;
        var fsn = fsns[myIdx];
        fetchSellersApi(fsn).then(function(sellers) {
          done++;
          results[myIdx] = { fsn: fsn, sellers: sellers || [], ok: !!(sellers && sellers.length) };
          chrome.runtime.sendMessage({
            action: 'fasttrack_api_progress',
            done: done,
            total: fsns.length,
            result: results[myIdx]
          });
          worker();
        });
      }

      if (!fsns.length) {
        chrome.runtime.sendMessage({ action: 'fasttrack_api_done', results: [] });
        sendResponse({ started: true, total: 0 });
        return true;
      }
      // Stagger worker starts slightly so the initial burst isn't a wall of
      // simultaneous requests.
      for (var i = 0; i < Math.min(concurrency, fsns.length); i++) {
        (function(workerFn, delay) {
          setTimeout(workerFn, delay);
        })(worker, i * 150);
      }
      sendResponse({ started: true, total: fsns.length });
      return true;
    }
  });

  console.log('[BuyBox Pro v4] Ready on', window.location.href);
})();
