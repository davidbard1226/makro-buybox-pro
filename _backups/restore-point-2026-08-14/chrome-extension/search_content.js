// search_content.js v2 — Makro Catalogue URL Finder
// Runs on makro.co.za/search pages
// Grabs the first product URL and sends it back to background.js

(function() {
  'use strict';

  if (!/\/search(\?|$|\/)/i.test(window.location.pathname + window.location.search)) return;

  function scrapeSearchResult() {
    const result = {
      searchUrl: window.location.href,
      searchQuery: new URLSearchParams(window.location.search).get('q') || '',
      foundUrl: null,
      foundTitle: null,
      timestamp: new Date().toISOString()
    };

    // Strategy 1: any anchor with /p/ in the href (broadest — works on most Makro layouts)
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    for (const a of links) {
      const href = a.href || '';
      if (/makro\.co\.za\/.+\/p\//i.test(href)) {
        result.foundUrl  = href.split('?')[0];
        const titleEl    = a.querySelector('p, span, h2, h3, div[class*="name"], div[class*="title"]');
        result.foundTitle = (titleEl && titleEl.innerText.trim()) ||
                             a.getAttribute('aria-label') ||
                             a.innerText.trim().substring(0, 100) || '';
        break;
      }
    }

    // Strategy 2: product cards with data attributes
    if (!result.foundUrl) {
      const cards = document.querySelectorAll(
        '[data-testid*="product"], [class*="product-card"], [class*="ProductCard"], [class*="product_card"]'
      );
      for (const card of cards) {
        const a = card.querySelector('a[href*="/p/"]');
        if (a && /makro\.co\.za/i.test(a.href)) {
          result.foundUrl = a.href.split('?')[0];
          const t = card.querySelector('h1,h2,h3,[class*="title"],[class*="name"]');
          result.foundTitle = t ? t.innerText.trim() : '';
          break;
        }
      }
    }

    // Strategy 3: JSON-LD structured data
    if (!result.foundUrl) {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const j = JSON.parse(s.textContent);
          const items = Array.isArray(j.itemListElement) ? j.itemListElement : [];
          if (items.length) {
            const first = items[0].url || (items[0].item && items[0].item.url) || '';
            if (first.includes('/p/')) {
              result.foundUrl   = first.split('?')[0];
              result.foundTitle = items[0].name || (items[0].item && items[0].item.name) || '';
            }
          }
        } catch(e) {}
      }
    }

    // Strategy 4: window.__NEXT_DATA__ or similar SSR data blobs
    if (!result.foundUrl) {
      try {
        const nd = window.__NEXT_DATA__ || window.__NUXT__ || null;
        if (nd) {
          const str  = JSON.stringify(nd);
          const m    = str.match(/https:\\?\/\\?\/www\.makro\.co\.za\\?\/[^"\\]+\\?\/p\\?\/[^"\\]+/);
          if (m) result.foundUrl = m[0].replace(/\\/g, '').split('?')[0];
        }
      } catch(e) {}
    }

    return result;
  }

  function sendResult() {
    const data = scrapeSearchResult();
    console.log('[CatSearch] Result:', JSON.stringify({ url: data.foundUrl, title: data.foundTitle }));
    try {
      chrome.runtime.sendMessage({ action: 'search_scraped', data: data }, function(r) {
        if (chrome.runtime.lastError) {
          console.warn('[CatSearch] sendMessage error:', chrome.runtime.lastError.message);
        }
      });
    } catch(e) {
      console.warn('[CatSearch] exception:', e.message);
    }
  }

  // Try at 3s, retry at 6s if nothing found yet (handles slow React renders)
  function waitAndSend() {
    setTimeout(function() {
      const data = scrapeSearchResult();
      if (data.foundUrl) {
        console.log('[CatSearch] Found at 3s:', data.foundUrl);
        try {
          chrome.runtime.sendMessage({ action: 'search_scraped', data: data }, function(r) {
            if (chrome.runtime.lastError) console.warn('[CatSearch]', chrome.runtime.lastError.message);
          });
        } catch(e) {}
      } else {
        // Retry after another 3s for slow-loading pages
        console.log('[CatSearch] Nothing at 3s, retrying at 6s…');
        setTimeout(sendResult, 3000);
      }
    }, 3000);
  }

  if (document.readyState === 'complete') {
    waitAndSend();
  } else {
    window.addEventListener('load', waitAndSend);
  }

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'scrape_search_now') {
      sendResponse({ success: true, data: scrapeSearchResult() });
      return true;
    }
  });

  console.log('[CatSearch v2] Ready on', window.location.href);
})();
