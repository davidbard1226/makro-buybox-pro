// portal.js v3 — Makro Seller Portal automation (robust, no recording needed)
// Directly navigates to the Upload page and injects the price file automatically.

(function() {
  'use strict';

  if (!window.location.hostname.includes('seller.makro.co.za') &&
      !window.location.hostname.includes('makromarketplace')) return;

  const FILE_KEY     = 'portal_upload_file';
  const NAME_KEY     = 'portal_upload_filename';
  const STATUS_KEY   = 'bbp_upload_status';

  // ── UTILITIES ──────────────────────────────────────────────────────────

  function log(msg) { console.log('[BBP Portal v3]', msg); }

  function setStatus(msg, color) {
    const el = document.getElementById('bbp-status');
    if (el) el.innerHTML = `<span style="color:${color||'#e8eaf0'}">${msg}</span>`;
    // Also persist status so it survives SPA navigation
    try { chrome.storage.local.set({ [STATUS_KEY]: { msg, color, ts: Date.now() } }); } catch(e) {}
  }

  // Wait for an element matching selector to appear in DOM (React async rendering)
  function waitForElement(selector, timeout) {
    timeout = timeout || 8000;
    return new Promise(function(resolve, reject) {
      const el = document.querySelector(selector);
      if (el) { resolve(el); return; }
      const observer = new MutationObserver(function() {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(function() { observer.disconnect(); reject(new Error('Timeout waiting for: ' + selector)); }, timeout);
    });
  }

  // Wait for an element whose text matches
  function waitForText(text, selector, timeout) {
    selector = selector || 'button, a, [role="button"], span, div';
    timeout  = timeout  || 8000;
    return new Promise(function(resolve, reject) {
      function find() {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t.toLowerCase().includes(text.toLowerCase()) && isVisible(el)) return el;
        }
        return null;
      }
      const existing = find();
      if (existing) { resolve(existing); return; }
      const observer = new MutationObserver(function() {
        const found = find();
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(function() { observer.disconnect(); reject(new Error('Timeout waiting for text: ' + text)); }, timeout);
    });
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  }

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function simulateClick(el) {
    if (!el) return;
    el.focus();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    el.click();
    el.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
  }

  // Attach a File object to an <input type="file"> and trigger React's onChange
  function attachFile(input, file) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files');
    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      const dt = new DataTransfer();
      dt.items.add(file);
      // Try React's internal setter first (needed for controlled inputs)
      try {
        nativeInputValueSetter.set.call(input, dt.files);
      } catch(e) {
        input.files = dt.files;
      }
    } else {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
    // Fire all the events React listens to
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // Also try React synthetic event
    const reactKey = Object.keys(input).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (reactKey) {
      try {
        const nativeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(nativeEvent, 'target', { writable: false, value: input });
        input.dispatchEvent(nativeEvent);
      } catch(e) {}
    }
    log('File attached: ' + file.name + ' (' + file.size + ' bytes)');
  }

  // ── MAIN UPLOAD FLOW ───────────────────────────────────────────────────

  async function runUpload() {
    setStatus('🔄 Starting upload...', '#ffd60a');

    // Step 1: Get the file from storage
    const stored = await new Promise(function(resolve) {
      chrome.storage.local.get([FILE_KEY, NAME_KEY], function(r) { resolve(r); });
    });

    if (!stored[FILE_KEY]) {
      setStatus('❌ No price file found.<br>Go to dashboard → 💰 Price Updater first.', '#ff4444');
      return;
    }

    // Reconstruct File object from base64
    let uploadFile;
    try {
      const byteStr = atob(stored[FILE_KEY]);
      const bytes   = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.ms-excel' });
      uploadFile = new File([blob], stored[NAME_KEY] || 'S_listing_price_update.xls', { type: 'application/vnd.ms-excel' });
    } catch(e) {
      setStatus('❌ Could not read file: ' + e.message, '#ff4444');
      return;
    }

    // Step 2: Navigate to the Listings bulk upload page if not already there
    const currentUrl = window.location.href;
    const isOnUploadPage = currentUrl.includes('listings') || currentUrl.includes('inventory');

    if (!currentUrl.includes('listings-management') && !currentUrl.includes('bulk-upload')) {
      setStatus('🔄 Navigating to Listings...', '#ffd60a');
      window.location.href = 'https://seller.makro.co.za/index.html#dashboard/listings-management?listingState=ACTIVE';
      // portal.js will re-run after navigation and pick up from storage
      await chrome.storage.local.set({ bbp_auto_upload: true });
      return;
    }

    setStatus('🔄 Looking for Upload button...', '#ffd60a');

    // Step 3: Find and click the "Upload" button on the listings page
    let uploadBtn = null;
    try {
      uploadBtn = await waitForText('upload', 'button, a, [role="button"]', 8000);
    } catch(e) {
      setStatus('❌ Upload button not found on this page.<br>Navigate to Listings first.', '#ff4444');
      return;
    }

    simulateClick(uploadBtn);
    await sleep(1500);
    setStatus('🔄 Upload dialog opening...', '#ffd60a');

    // Step 4: Look for file input (may be hidden, inside a modal/dialog)
    let fileInput = null;
    try {
      fileInput = await waitForElement('input[type="file"]', 6000);
    } catch(e) {
      // Try to find it anywhere including hidden
      fileInput = document.querySelector('input[type="file"]');
    }

    if (!fileInput) {
      // Maybe we need to click a "Bulk Upload" or "Import" option first
      setStatus('🔄 Looking for Bulk Upload option...', '#ffd60a');
      try {
        const bulkBtn = await waitForText('bulk', 'button, a, [role="button"], [role="menuitem"], li, span', 4000);
        simulateClick(bulkBtn);
        await sleep(1200);
        fileInput = await waitForElement('input[type="file"]', 5000);
      } catch(e) {
        setStatus('❌ Could not find file input.<br>Try clicking Upload manually first.', '#ff9500');
        return;
      }
    }

    // Step 5: Attach the file
    setStatus('📎 Attaching price file...', '#ffd60a');
    attachFile(fileInput, uploadFile);
    await sleep(1000);

    // Step 6: Find and click the confirm/submit button
    setStatus('🔄 Looking for confirm button...', '#ffd60a');
    let confirmBtn = null;
    const confirmTexts = ['confirm', 'submit', 'upload file', 'proceed', 'import', 'ok'];
    for (const text of confirmTexts) {
      try {
        confirmBtn = await waitForText(text, 'button, [role="button"]', 2000);
        if (confirmBtn) break;
      } catch(e) {}
    }

    if (confirmBtn) {
      simulateClick(confirmBtn);
      await sleep(1000);
      setStatus('✅ File uploaded! Check portal for confirmation.', '#00e5a0');
      // Clear the auto-upload flag
      chrome.storage.local.remove('bbp_auto_upload');
    } else {
      setStatus('⚠️ File attached — click <b>Confirm/Submit</b> manually to finish.', '#ffd60a');
    }
  }

  // ── OVERLAY UI ─────────────────────────────────────────────────────────

  function createOverlay() {
    if (document.getElementById('bbp-overlay')) return;
    const el = document.createElement('div');
    el.id = 'bbp-overlay';
    const s = el.style;
    s.setProperty('position',      'fixed',              'important');
    s.setProperty('bottom',        '12px',               'important');
    s.setProperty('right',         '12px',               'important');
    s.setProperty('top',           'auto',               'important');
    s.setProperty('left',          'auto',               'important');
    s.setProperty('z-index',       '2147483647',         'important');
    s.setProperty('background',    '#0a0c10',            'important');
    s.setProperty('border',        '1px solid #00e5a0',  'important');
    s.setProperty('border-radius', '7px',                'important');
    s.setProperty('padding',       '7px 10px',           'important');
    s.setProperty('width',         '200px',              'important');
    s.setProperty('font-family',   'monospace',          'important');
    s.setProperty('font-size',     '10px',               'important');
    s.setProperty('color',         '#e8eaf0',            'important');
    s.setProperty('user-select',   'none',               'important');
    s.setProperty('opacity',       '0.95',               'important');
    s.setProperty('box-shadow',    '0 2px 10px rgba(0,0,0,0.5)', 'important');

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:9px;letter-spacing:1px;color:#00e5a0;text-transform:uppercase">🛒 BuyBox Pro</span>
        <button id="bbp-minimize" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:11px;padding:0;line-height:1" title="Minimize">−</button>
      </div>
      <div id="bbp-body">
        <div id="bbp-status" style="color:#6b7280;margin-bottom:6px;font-size:10px;line-height:1.4">Loading...</div>
        <div id="bbp-buttons" style="display:flex;flex-direction:column;gap:4px"></div>
      </div>
    `;
    document.body.appendChild(el);

    let minimized = false;
    document.getElementById('bbp-minimize').addEventListener('click', function() {
      minimized = !minimized;
      document.getElementById('bbp-body').style.display = minimized ? 'none' : 'block';
      this.textContent = minimized ? '+' : '−';
      el.style.setProperty('opacity', minimized ? '0.6' : '0.95', 'important');
    });

    renderOverlay();
  }

  function addBtn(container, label, color, fn) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'background:' + (color === '#00e5a0' ? '#00e5a0' : 'transparent'),
      'color:'       + (color === '#00e5a0' ? '#000'    : color),
      'border:1px solid ' + color,
      'border-radius:4px', 'padding:5px 8px', 'cursor:pointer',
      'font-family:monospace', 'font-size:10px', 'font-weight:700',
      'text-align:left', 'width:100%', 'line-height:1.3'
    ].join(';');
    b.addEventListener('click', fn);
    container.appendChild(b);
  }

  function renderOverlay() {
    const status  = document.getElementById('bbp-status');
    const buttons = document.getElementById('bbp-buttons');
    if (!status || !buttons) return;
    buttons.innerHTML = '';

    chrome.storage.local.get([FILE_KEY, NAME_KEY, STATUS_KEY], function(r) {
      if (chrome.runtime.lastError) return;
      const hasFile  = !!r[FILE_KEY];
      const filename = r[NAME_KEY] || 'price_update.xls';
      const lastStatus = r[STATUS_KEY];

      if (!hasFile) {
        status.innerHTML = '⚠️ No price file ready.<br>Go to dashboard → 💰 Price Updater first.';
        addBtn(buttons, '🌐 Open Dashboard', '#6b7280', function() {
          window.open('https://davidbard1226.github.io/makro-buybox-pro/', '_blank');
        });
        return;
      }

      // Show last status if recent (< 30s)
      if (lastStatus && (Date.now() - lastStatus.ts) < 30000) {
        status.innerHTML = lastStatus.msg ? `<span style="color:${lastStatus.color}">${lastStatus.msg}</span>` : '';
      } else {
        status.innerHTML = `📁 <b style="color:#ffd60a">${filename}</b><br>Ready to auto-upload.`;
      }

      addBtn(buttons, '🚀 Auto Upload Now', '#00e5a0', function() {
        runUpload().catch(function(e) {
          setStatus('❌ Error: ' + e.message, '#ff4444');
        });
      });
      addBtn(buttons, '🌐 Open Dashboard', '#6b7280', function() {
        window.open('https://davidbard1226.github.io/makro-buybox-pro/', '_blank');
      });
      addBtn(buttons, '🗑 Clear File', '#6b7280', function() {
        if (!confirm('Clear the saved price file?')) return;
        chrome.storage.local.remove([FILE_KEY, NAME_KEY, STATUS_KEY], renderOverlay);
      });
    });
  }

  // ── INIT ───────────────────────────────────────────────────────────────

  function init() {
    if (document.body) createOverlay();
    else document.addEventListener('DOMContentLoaded', createOverlay);

    // Re-render overlay on SPA navigation
    let lastUrl = window.location.href;
    setInterval(function() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(function() {
          const ov = document.getElementById('bbp-overlay');
          if (!ov) createOverlay();
          else renderOverlay();

          // Auto-trigger upload if flagged
          chrome.storage.local.get(['bbp_auto_upload'], function(r) {
            if (r.bbp_auto_upload) {
              setTimeout(function() {
                runUpload().catch(function(e) { setStatus('❌ ' + e.message, '#ff4444'); });
              }, 2000);
            }
          });
        }, 1800);
      }
    }, 1000);

    // Check if we should auto-trigger on page load
    chrome.storage.local.get(['bbp_auto_upload'], function(r) {
      if (r.bbp_auto_upload) {
        setTimeout(function() {
          runUpload().catch(function(e) { setStatus('❌ ' + e.message, '#ff4444'); });
        }, 3000);
      }
    });
  }

  init();
  log('Ready on ' + window.location.hostname);
})();
