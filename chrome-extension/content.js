// content.js v4 — Makro BuyBox Pro
// Robust seller name extraction + correct price selector

(function() {
  'use strict';

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

  // ── MAIN SCRAPE ────────────────────────────────────────────────────────────
  function scrapeProduct() {
    try {
      const data = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        sku: null,
        title: null,
        buyBoxPrice: null,
        buyBoxSeller: null,
        hasBuyBox: false,
        inStock: null
      };

      // SKU from URL path (itm... part)
      const skuMatch = window.location.pathname.match(/\/p\/([^/?#]+)/);
      if (skuMatch) data.sku = skuMatch[1];

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

      // 3. data-* attributes on product container
      if (!data.fsn) {
        const el = document.querySelector('[data-fsn],[data-pid],[data-product-id],[data-item-id]');
        if (el) {
          const val = (el.dataset.fsn || el.dataset.pid || el.dataset.productId || el.dataset.itemId || '').trim();
          if (/^[A-Z0-9]{8,}$/i.test(val)) data.fsn = val.toUpperCase();
        }
      }

      // 4. Canonical URL sometimes has FSN embedded differently
      if (!data.fsn) {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
          const m = canonical.href.match(/[?&]pid=([A-Z0-9]{8,})/i);
          if (m) data.fsn = m[1].toUpperCase();
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

      // ── PRICE: use exact user selector first ─────────────────────────────
      // Full path ends at: div.Xaaq-1._16Jk6d
      const exactEl = document.querySelector('div.Xaaq-1._16Jk6d');
      if (exactEl) {
        const p = extractPrice(exactEl.innerText);
        if (p) data.buyBoxPrice = p;
      }

      // Fallback: scan all price-looking elements, take the LOWEST that looks like a real price
      if (!data.buyBoxPrice) {
        const candidates = [];
        document.querySelectorAll('[class*="Xaaq"],[class*="price"],[class*="Price"],[class*="amount"],[class*="cost"],[class*="dyC4"],[class*="CEmi"]').forEach(el => {
          if (el.children.length > 2) return;
          const txt = (el.innerText || '').trim();
          // Only try lines that contain "R" or look like a rand amount
          if (!/R\s*[\d,. ]+/i.test(txt)) return;
          const p = extractPrice(txt);
          if (p && p > 10) candidates.push(p); // ignore implausibly small values
        });
        if (candidates.length) data.buyBoxPrice = Math.min(...candidates);
      }

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

      return data;
    } catch(e) {
      console.error('[BuyBox v4] Error:', e);
      return { url: window.location.href, timestamp: new Date().toISOString(), error: e.message };
    }
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
    // Makro sellers page uses format: R 8,27000 (comma=thousands, last 2 digits=cents, no decimal point)
    var cleaned = s.replace(/,/g, '');
    if (cleaned.indexOf('.') >= 0) return parseFloat(cleaned);
    if (cleaned.length <= 2) return parseFloat(cleaned);
    return parseFloat(cleaned.slice(0, -2) + '.' + cleaned.slice(-2));
  }

  function scrapeSellersPage() {
    return new Promise(function(resolve) {
      function tryExtract() {
        var sellers = [];
        // Strategy 1: Find "Seller" heading span, walk sibling rows
        var spans = document.querySelectorAll('span');
        for (var i = 0; i < spans.length; i++) {
          var txt = (spans[i].textContent || '').trim();
          if (txt === 'Seller') {
            var row = spans[i].parentElement;
            while (row) {
              var inner = (row.textContent || '').trim();
              if (/^[A-Z]/.test(inner) && /R\s*[\d,]/.test(inner) && inner.length < 120) {
                var pm = inner.match(/R\s*([\d,]+)/);
                if (pm) {
                  var price = parseSellerPrice(pm[1]);
                  if (price > 1) {
                    var name = inner.replace(/R\s*[\d,]+/g, '').trim();
                    name = name.replace(/\s*Free|\d+\s*-\s*\d+\s*(Days|Business|Working)/gi, '').trim();
                    if (name && name.length > 1 && name.length < 80) {
                      sellers.push({ seller: name, price: price });
                    }
                  }
                }
              }
              row = row.nextElementSibling;
            }
            break;
          }
        }
        if (sellers.length > 0) return sellers;

        // Strategy 2: Look for table structure (table with seller rows)
        var tables = document.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
          var rows2 = tables[t].querySelectorAll('tr');
          for (var r = 0; r < rows2.length; r++) {
            var cells = rows2[r].querySelectorAll('td, th');
            if (cells.length >= 2) {
              var sellerName = (cells[0].textContent || '').trim();
              var priceText = '';
              for (var c = 1; c < cells.length; c++) {
                var ct = (cells[c].textContent || '').trim();
                if (/R\s*[\d,]/.test(ct)) { priceText = ct; break; }
              }
              if (sellerName && priceText && /^[A-Z]/.test(sellerName) && sellerName.length < 80) {
                var pm2 = priceText.match(/R\s*([\d,]+)/);
                if (pm2) {
                  var price2 = parseSellerPrice(pm2[1]);
                  if (price2 > 1) sellers.push({ seller: sellerName, price: price2 });
                }
              }
            }
          }
          if (sellers.length > 0) return sellers;
        }

        // Strategy 3: Scan all elements for seller rows (flexbox/grid layout)
        var rows3 = document.querySelectorAll('[class*="row"],[class*="Row"],[class*="item"],[class*="seller-list"] > *, [class*="sellerList"] > *');
        for (var s = 0; s < rows3.length; s++) {
          var inner3 = (rows3[s].textContent || '').trim();
          if (/^[A-Z]/.test(inner3) && /R\s*[\d,]/.test(inner3) && inner3.length < 120) {
            var pm3 = inner3.match(/R\s*([\d,]+)/);
            if (pm3) {
              var price3 = parseSellerPrice(pm3[1]);
              if (price3 > 1) {
                var name3 = inner3.replace(/R\s*[\d,]+/g, '').trim();
                name3 = name3.replace(/\s*Free|\d+\s*-\s*\d+\s*(Days|Business|Working)/gi, '').trim();
                if (name3 && name3.length > 1 && name3.length < 80) {
                  // Avoid duplicates
                  if (!sellers.some(function(ex) { return ex.seller === name3 && Math.abs(ex.price - price3) < 0.01; })) {
                    sellers.push({ seller: name3, price: price3 });
                  }
                }
              }
            }
          }
        }
        return sellers;
      }

      var immediate = tryExtract();
      if (immediate.length > 0) { resolve(immediate); return; }

      var attempts = 0;
      var observer = new MutationObserver(function() {
        var result = tryExtract();
        if (result.length > 0) { observer.disconnect(); resolve(result); }
        if (++attempts > 100) { observer.disconnect(); resolve(result); }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });

      setTimeout(function() {
        observer.disconnect();
        resolve(tryExtract());
      }, 10000);
    });
  }

  // ── AUTO SCRAPE ────────────────────────────────────────────────────────────
  if (/\/p\/[A-Za-z0-9_]+/.test(window.location.pathname)) {
    const run = function() {
      const d = scrapeProduct();
      saveProduct(d);
      // Notify background so queue can advance to next URL
      try {
        chrome.runtime.sendMessage({ action: 'page_scraped', data: d });
      } catch(e) {}
      // If sellers URL found, tell background to fetch seller data
      if (d && d.sellersUrl && d.fsn) {
        try {
          chrome.runtime.sendMessage({ action: 'fetch_sellers', fsn: d.fsn, sellersUrl: d.sellersUrl });
        } catch(e) {}
      }
    };
    if (document.readyState === 'complete') setTimeout(run, 1500);
    else window.addEventListener('load', function() { setTimeout(run, 2000); });
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
    if (document.readyState === 'complete') setTimeout(sellersRun, 3000);
    else window.addEventListener('load', function() { setTimeout(sellersRun, 3500); });
  }

  // ── MESSAGES ───────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'ping') { sendResponse({ pong: true }); return true; }
    if (msg.action === 'scrape_now' || msg.action === 'SCRAPE_URL') {
      const d = scrapeProduct();
      saveProduct(d);
      sendResponse({ success: true, data: d });
      if (d && d.sellersUrl && d.fsn) {
        try { chrome.runtime.sendMessage({ action: 'fetch_sellers', fsn: d.fsn, sellersUrl: d.sellersUrl }); } catch(e) {}
      }
      return true;
    }
    // SCRAPE SELLERS PAGE (called from background)
    if (msg.action === 'scrape_sellers') {
      console.log('[BuyBox v4] scrape_sellers message received');
      scrapeSellersPage().then(function(sellers) {
        var fsn = (window.location.search.match(/[?&]pid=([A-Z0-9]{8,})/i) || [])[1];
        console.log('[BuyBox v4] scrape_sellers result:', sellers.length, 'sellers for FSN', fsn);
        sendResponse({ success: true, fsn: fsn ? fsn.toUpperCase() : '', sellers: sellers });
      });
      return true;
    }
    // DEBUG: return raw seller candidates
    if (msg.action === 'debug_seller') {
      const body = document.body.innerText || '';
      const lines = body.split('\n').filter(l => /sold|seller|fulfill/i.test(l)).slice(0,10);
      sendResponse({ lines });
      return true;
    }
  });

  console.log('[BuyBox Pro v4] Ready on', window.location.href);
})();
