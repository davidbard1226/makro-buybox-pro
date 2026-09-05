// Cache-busted dashboard URL — GitHub Pages caches the HTML for ~10 min, so a
// plain URL keeps serving the OLD version no matter how many times the user
// refreshes. The ?v= timestamp forces a fresh fetch on every open.
const DASH = 'https://davidbard1226.github.io/makro-buybox-pro/?v=' + Date.now();
let currentTabId = null;

// ── LOAD STORAGE STATS ──────────────────────────────────────────────────────
chrome.storage.local.get(['buybox_products'], function(r) {
  const products = r.buybox_products || [];
  document.getElementById('count').textContent = products.length;
  if (products.length > 0) {
    const last = new Date(products[products.length - 1].timestamp);
    document.getElementById('last-time').textContent =
      last.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('dot').className = 'dot green';
  }
});

// ── SET STATUS HELPER ───────────────────────────────────────────────────────
function setStatus(msg, color) {
  const el = document.getElementById('status');
  el.innerHTML = '<span style="color:' + color + '">' + msg + '</span>';
}

// ── CHECK CURRENT TAB ───────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  if (!tab) { setStatus('No active tab found', '#ff4d6d'); return; }
  currentTabId = tab.id;
  const url = tab.url || '';

  if (!url.includes('makro.co.za')) {
    setStatus('⚠️ Navigate to a Makro product page first', '#ffd60a');
    document.getElementById('dot').className = 'dot orange';
    return;
  }

  // Ping to check if content script is already loaded
  chrome.tabs.sendMessage(tab.id, { action: 'ping' }, function(resp) {
    if (chrome.runtime.lastError || !resp) {
      // Not loaded — inject it now
      setStatus('⏳ Injecting scraper...', '#ffd60a');
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ['content.js'] },
        function() {
          if (chrome.runtime.lastError) {
            setStatus('❌ Inject failed — reload the Makro page', '#ff4d6d');
          } else {
            setStatus('✅ Ready to scrape!', '#00e5a0');
            document.getElementById('dot').className = 'dot green';
            document.getElementById('btn-scrape').disabled = false;
          }
        }
      );
    } else {
      setStatus('✅ On Makro — ready to scrape!', '#00e5a0');
      document.getElementById('dot').className = 'dot green';
      document.getElementById('btn-scrape').disabled = false;
    }
  });
});

// ── SCRAPE BUTTON ───────────────────────────────────────────────────────────
document.getElementById('btn-scrape').addEventListener('click', function() {
  const btn = this;
  btn.disabled = true;
  btn.textContent = '⏳ Scraping...';
  setStatus('Scraping page...', '#9ca3af');

  chrome.tabs.sendMessage(currentTabId, { action: 'scrape_now' }, function(resp) {
    btn.disabled = false;
    btn.textContent = '📡 Scrape This Page';

    if (chrome.runtime.lastError) {
      setStatus('❌ ' + chrome.runtime.lastError.message, '#ff4d6d');
      return;
    }
    if (resp && resp.success && resp.data) {
      const d = resp.data;
      const name = d.title
        ? d.title.substring(0, 30) + (d.title.length > 30 ? '…' : '')
        : (d.sku || d.url);
      const price = d.buyBoxPrice ? ' R' + d.buyBoxPrice.toLocaleString('en-ZA', {minimumFractionDigits:2}) : '';
      const seller = d.buyBoxSeller
        ? '<br><span style="color:#ffd60a">👤 ' + d.buyBoxSeller + '</span>'
        : '<br><span style="color:#ff4d6d">👤 Seller not found — check console</span>';
      setStatus('✅ ' + name + price + seller, '#00e5a0');
      document.getElementById('dot').className = 'dot green';
      chrome.storage.local.get(['buybox_products'], function(r) {
        const products = r.buybox_products || [];
        document.getElementById('count').textContent = products.length;
        const now = new Date();
        document.getElementById('last-time').textContent =
          now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      });
    } else {
      const msg = (resp && resp.error) ? resp.error : 'No data found on this page';
      setStatus('❌ ' + msg, '#ff4d6d');
    }
  });
});

// ── DASHBOARD BUTTON ────────────────────────────────────────────────────────
document.getElementById('btn-dashboard').addEventListener('click', function() {
  chrome.tabs.create({ url: DASH });
});

// Footer link uses the same cache-busted URL
document.getElementById('link-dashboard').addEventListener('click', function() {
  this.href = DASH;
});

// ── CLEAR BUTTON ─────────────────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', function() {
  const count = document.getElementById('count').textContent;
  if (!confirm('Clear all ' + count + ' tracked products?')) return;
  chrome.storage.local.set({ buybox_products: [] }, function() {
    document.getElementById('count').textContent = '0';
    document.getElementById('last-time').textContent = '—';
    document.getElementById('dot').className = 'dot';
    setStatus('🗑 All data cleared', '#6b7280');
  });
});
