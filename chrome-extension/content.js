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
        inStock: null,
        sellersUrl: null
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
      const d = scrapeProduct();
      saveProduct(d);
      // Notify background so queue can advance to next URL
      try {
        chrome.runtime.sendMessage({ action: 'page_scraped', data: d });
      } catch(e) {}
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
      return true;
    }
  });

  console.log('[BuyBox Pro v4] Ready on', window.location.href);
})();
