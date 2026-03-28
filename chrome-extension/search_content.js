// search_content.js — Makro Catalogue URL Finder
// Runs on makro.co.za/search pages
// Grabs the first product URL and sends it back to background.js

(function() {
  'use strict';

  if (!/\/search(\?|$)/.test(window.location.href) &&
      !/\/search\//.test(window.location.href)) return;

  function scrapeSearchResult() {
    const result = {
      searchUrl: window.location.href,
      searchQuery: new URLSearchParams(window.location.search).get('q') || '',
      foundUrl: null,
      foundTitle: null,
      timestamp: new Date().toISOString()
    };

    // Strategy 1: find product links matching /something/p/itm or /something/p/INT
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const a of links) {
      const href = a.href || '';
      if (/makro\.co\.za\/[a-z0-9-]+\/p\/[A-Z0-9]{6,}/i.test(href)) {
        const clean = href.split('?')[0];
        if (!result.foundUrl) {
          result.foundUrl = clean;
          const titleEl = a.querySelector('p, span, div, h2, h3');
          result.foundTitle = (titleEl && titleEl.innerText.trim()) ||
                               a.innerText.trim().substring(0, 80) ||
                               a.getAttribute('aria-label') || '';
        }
      }
    }

    // Strategy 2: JSON-LD structured data
    if (!result.foundUrl) {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const j = JSON.parse(s.textContent);
          const items = j['@type'] === 'ItemList' ? (j.itemListElement || []) : [];
          if (items.length > 0) {
            const first = items[0].url || (items[0].item && items[0].item.url) || '';
            if (first && first.includes('/p/')) {
              result.foundUrl = first.split('?')[0];
              result.foundTitle = items[0].name || (items[0].item && items[0].item.name) || '';
            }
          }
        } catch(e) {}
      }
    }

    // Strategy 3: data attributes
    if (!result.foundUrl) {
      const cards = document.querySelectorAll(
        '[data-testid*="product"], [class*="product-card"], [class*="ProductCard"]'
      );
      for (const card of cards) {
        const a = card.querySelector('a[href*="/p/"]');
        if (a) {
          result.foundUrl = a.href.split('?')[0];
          const t = card.querySelector('h1,h2,h3,p[class*="title"],p[class*="name"]');
          result.foundTitle = t ? t.innerText.trim() : '';
          break;
        }
      }
    }

    return result;
  }

  function sendResult() {
    const data = scrapeSearchResult();
    console.log('[CatSearch] Result:', data);
    try {
      chrome.runtime.sendMessage({ action: 'search_scraped', data: data });
    } catch(e) {}
  }

  // Wait for dynamic content to load
  if (document.readyState === 'complete') {
    setTimeout(sendResult, 2500);
  } else {
    window.addEventListener('load', function() { setTimeout(sendResult, 2500); });
  }

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'scrape_search_now') {
      sendResponse({ success: true, data: scrapeSearchResult() });
      return true;
    }
  });

  console.log('[CatSearch] Ready on', window.location.href);
})();
