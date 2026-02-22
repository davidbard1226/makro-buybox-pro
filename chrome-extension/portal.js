// portal.js — runs on seller.makro.co.za
// Automates the bulk price upload workflow:
// 1. Detects when we're on the My Listings page
// 2. Injects an "Auto-Upload Price File" button into the toolbar
// 3. When clicked, handles the file input and upload flow automatically

(function() {
  'use strict';

  // Only run on Listings pages
  if (!/\/listings|\/my-listings|\/products/i.test(window.location.pathname)) return;

  let injected = false;

  function injectButton() {
    if (injected) return;

    // Look for the Upload button or toolbar area in the portal
    const uploadBtn = document.querySelector(
      'button[data-testid*="upload"], button[aria-label*="upload" i], ' +
      'button[class*="upload" i], a[href*="upload"], .upload-btn, ' +
      '[class*="toolbar"] button, [class*="action"] button'
    );

    const container = uploadBtn
      ? uploadBtn.parentElement
      : (document.querySelector('[class*="toolbar"],[class*="actions"],[class*="header"]') || document.body);

    if (!container) return;

    // Create our button
    const btn = document.createElement('button');
    btn.id = 'buybox-auto-upload';
    btn.innerHTML = '🚀 BuyBox Pro — Upload Price File';
    btn.style.cssText = [
      'background:#00e5a0', 'color:#000', 'border:none', 'padding:8px 18px',
      'border-radius:6px', 'font-weight:700', 'font-size:13px', 'cursor:pointer',
      'margin-left:12px', 'white-space:nowrap', 'box-shadow:0 0 12px rgba(0,229,160,0.4)'
    ].join(';');

    btn.addEventListener('click', function() {
      triggerUpload();
    });

    container.appendChild(btn);
    injected = true;
    console.log('[BuyBox Portal] Auto-upload button injected');
  }

  function triggerUpload() {
    // Check if we have a pending file from the dashboard
    chrome.storage.local.get(['portal_upload_file', 'portal_upload_filename'], function(r) {
      if (chrome.runtime.lastError || !r.portal_upload_file) {
        showPortalNotice(
          '⚠️ No price file ready. Go to your BuyBox Pro dashboard → 💰 Price Updater → Generate Price Update File first.',
          '#ff9500'
        );
        return;
      }

      // Reconstruct the file from base64
      const base64 = r.portal_upload_file;
      const filename = r.portal_upload_filename || 'S_listing_price_update.xls';
      const byteStr = atob(base64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.ms-excel' });
      const file = new File([blob], filename, { type: 'application/vnd.ms-excel' });

      // Find the upload file input on the page
      const fileInput = findUploadInput();
      if (fileInput) {
        setFileOnInput(fileInput, file);
        showPortalNotice('✅ File attached: ' + filename + ' — click Upload to confirm.', '#00e5a0');
      } else {
        // Try clicking the portal's own Upload button first to open the file dialog
        const uploadBtn = document.querySelector(
          'button[data-testid*="upload"], button[aria-label*="upload" i], ' +
          'button[class*="upload" i]:not(#buybox-auto-upload)'
        );
        if (uploadBtn) {
          // Intercept the file input that appears after clicking
          document.addEventListener('click', function interceptInput(e) {
            setTimeout(function() {
              const inp = findUploadInput();
              if (inp) {
                setFileOnInput(inp, file);
                showPortalNotice('✅ File attached: ' + filename, '#00e5a0');
                document.removeEventListener('click', interceptInput);
              }
            }, 500);
          }, { once: true });
          uploadBtn.click();
        } else {
          showPortalNotice('⚠️ Could not find the upload input. Please use the portal\'s Upload button and select the downloaded file manually.', '#ff9500');
        }
      }
    });
  }

  function findUploadInput() {
    return document.querySelector(
      'input[type="file"][accept*="xls"], input[type="file"][accept*="excel"], ' +
      'input[type="file"][accept*=".xls"], input[type="file"]'
    );
  }

  function setFileOnInput(input, file) {
    // Use DataTransfer trick to programmatically set file on input
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function showPortalNotice(msg, color) {
    let el = document.getElementById('buybox-portal-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'buybox-portal-notice';
      el.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px', 'z-index:99999',
        'padding:14px 20px', 'border-radius:10px', 'font-size:14px',
        'font-weight:600', 'max-width:400px', 'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
        'background:#111418', 'border:2px solid ' + color, 'color:#fff'
      ].join(';');
      document.body.appendChild(el);
    }
    el.style.borderColor = color;
    el.innerHTML = msg + '<br><small style="color:#999;font-weight:400">BuyBox Pro</small>';
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 8000);
  }

  // Wait for portal to fully render then inject
  function waitAndInject() {
    const timer = setInterval(function() {
      const bodyLoaded = document.body && document.body.children.length > 3;
      if (bodyLoaded) {
        injectButton();
        if (injected) clearInterval(timer);
      }
    }, 1500);
    // Stop trying after 30s
    setTimeout(function() { clearInterval(timer); }, 30000);
  }

  waitAndInject();

  // Also watch for SPA navigation (portal is a React app)
  let lastPath = window.location.pathname;
  setInterval(function() {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      injected = false;
      if (/\/listings|\/my-listings|\/products/i.test(lastPath)) {
        setTimeout(waitAndInject, 1000);
      }
    }
  }, 1000);

  console.log('[BuyBox Portal v1] Active on', window.location.href);
})();
