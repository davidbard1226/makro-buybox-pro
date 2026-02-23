// portal.js v2 — Makro Seller Portal automation
// Two modes:
//   RECORD: watches you do the upload manually once, saves the click sequence
//   REPLAY: replays that sequence automatically with the new price file

(function() {
  'use strict';

  // Only run on the seller portal
  if (!window.location.hostname.includes('seller.makro.co.za') &&
      !window.location.hostname.includes('makromarketplace')) return;

  const RECIPE_KEY  = 'portal_upload_recipe';
  const FILE_KEY    = 'portal_upload_file';
  const NAME_KEY    = 'portal_upload_filename';

  let recording     = false;
  let replaying     = false;
  let recordedSteps = [];
  let replayStep    = 0;
  let replayFile    = null;

  // ── UI OVERLAY ─────────────────────────────────────────────────────────
  function createOverlay() {
    if (document.getElementById('bbp-overlay')) return;
    const el = document.createElement('div');
    el.id = 'bbp-overlay';
    el.style.cssText = [
      'position:fixed','bottom:16px','right:16px','top:auto','left:auto',
      'z-index:2147483647',
      'background:#0a0c10','border:1px solid #00e5a0','border-radius:8px',
      'padding:8px 12px','min-width:180px','max-width:220px',
      'box-shadow:0 2px 12px rgba(0,229,160,0.15)',
      'font-family:monospace','font-size:11px','color:#e8eaf0',
      'user-select:none','opacity:0.92'
    ].join(';');
    el.innerHTML = `
      <div style="font-size:9px;letter-spacing:1px;color:#00e5a0;margin-bottom:6px;text-transform:uppercase">
        🛒 BuyBox Pro
      </div>
      <div id="bbp-status" style="color:#6b7280;margin-bottom:8px;font-size:10px;line-height:1.4">
        Loading...
      </div>
      <div id="bbp-buttons" style="display:flex;flex-direction:column;gap:4px"></div>
    `;
    document.body.appendChild(el);
    updateOverlay();
  }

  function updateOverlay() {
    const status  = document.getElementById('bbp-status');
    const buttons = document.getElementById('bbp-buttons');
    if (!status || !buttons) return;

    chrome.storage.local.get([RECIPE_KEY, FILE_KEY, NAME_KEY], function(r) {
      if (chrome.runtime.lastError) return;

      const hasRecipe = !!(r[RECIPE_KEY] && r[RECIPE_KEY].steps && r[RECIPE_KEY].steps.length > 0);
      const hasFile   = !!r[FILE_KEY];
      const filename  = r[NAME_KEY] || 'price_update.xls';

      buttons.innerHTML = '';

      if (!hasFile) {
        status.innerHTML = '⚠️ No price file ready.<br>Go to dashboard → 💰 Price Updater first.';
        return;
      }

      if (!hasRecipe) {
        status.innerHTML  = `📁 File ready: <b style="color:#ffd60a">${filename}</b><br><br>` +
          `<span style="color:#ff9500">No upload recipe recorded yet.</span><br>` +
          `Click <b>Record</b> and do your normal bulk upload once — we'll watch and remember the steps.`;
        addBtn(buttons, '⏺ Record Upload Steps', '#ff9500', startRecording);
      } else {
        const recipe = r[RECIPE_KEY];
        const stepCount = recipe.steps.length;
        status.innerHTML = `📁 <b style="color:#ffd60a">${filename}</b><br>` +
          `✅ Recipe: <span style="color:#00e5a0">${stepCount} steps recorded</span><br>` +
          `Ready to auto-upload.`;
        addBtn(buttons, '🚀 Auto Upload Now', '#00e5a0', startReplay);
        addBtn(buttons, '⏺ Re-record Steps', '#6b7280', startRecording);
        addBtn(buttons, '👁 Show Recipe', '#6b7280', showRecipe);
      }
    });
  }

  function addBtn(container, label, color, fn) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      `background:${color === '#00e5a0' ? '#00e5a0' : 'transparent'}`,
      `color:${color === '#00e5a0' ? '#000' : color}`,
      `border:1px solid ${color}`,
      'border-radius:4px','padding:5px 8px','cursor:pointer',
      'font-family:monospace','font-size:10px','font-weight:700',
      'text-align:left','width:100%'
    ].join(';');
    b.addEventListener('click', fn);
    container.appendChild(b);
  }

  function setStatus(msg, color) {
    const el = document.getElementById('bbp-status');
    if (el) el.innerHTML = `<span style="color:${color||'#e8eaf0'}">${msg}</span>`;
  }

  // ── RECORDING ─────────────────────────────────────────────────────────
  function startRecording() {
    recording     = true;
    recordedSteps = [];
    setStatus('⏺ RECORDING — do your normal upload now...', '#ff9500');

    // Flash border to indicate recording
    const overlay = document.getElementById('bbp-overlay');
    if (overlay) overlay.style.borderColor = '#ff9500';

    // Watch ALL clicks on the page
    document.addEventListener('click', recordClick, true);
    // Watch file inputs
    document.addEventListener('change', recordChange, true);

    notify('Recording started — perform your bulk upload now. Click "Stop Recording" when done.');
    addStopBtn();
  }

  function addStopBtn() {
    const buttons = document.getElementById('bbp-buttons');
    if (!buttons) return;
    // Add stop button at top
    const b = document.createElement('button');
    b.id    = 'bbp-stop-record';
    b.textContent = '⏹ Stop Recording';
    b.style.cssText = 'background:#ff4444;color:#fff;border:none;border-radius:6px;padding:7px 12px;cursor:pointer;font-family:monospace;font-size:12px;font-weight:700;';
    b.addEventListener('click', stopRecording);
    buttons.insertBefore(b, buttons.firstChild);
  }

  function recordClick(e) {
    if (!recording) return;
    if (e.target.closest('#bbp-overlay')) return; // ignore our own UI

    const el   = e.target;
    const tag  = el.tagName;
    const text = (el.innerText || el.textContent || el.value || el.placeholder || '').trim().slice(0, 80);
    const role = el.getAttribute('role') || '';
    const type = el.getAttribute('type') || '';
    const id   = el.id || '';
    const cls  = el.className || '';
    const href = el.href || '';

    // Skip invisible or script elements
    if (['SCRIPT','STYLE','HEAD'].includes(tag)) return;
    if (type === 'file') return; // handled by recordChange

    const step = {
      action:  'click',
      tag,
      text:    text.slice(0, 60),
      role,
      type,
      id:      id.slice(0, 40),
      classes: cls.slice(0, 80),
      href,
      ts:      Date.now()
    };

    recordedSteps.push(step);
    console.log('[BBP Record] Click:', step.text || step.tag);
  }

  function recordChange(e) {
    if (!recording) return;
    const el = e.target;
    if (el.type !== 'file') return;

    // This is the file input — record it
    recordedSteps.push({
      action:  'file_input',
      tag:     el.tagName,
      id:      el.id || '',
      name:    el.name || '',
      accept:  el.accept || '',
      classes: (el.className || '').slice(0, 80),
      ts:      Date.now()
    });
    console.log('[BBP Record] File input detected');
  }

  function stopRecording() {
    recording = false;
    document.removeEventListener('click', recordClick, true);
    document.removeEventListener('change', recordChange, true);

    const overlay = document.getElementById('bbp-overlay');
    if (overlay) overlay.style.borderColor = '#00e5a0';

    // Clean up: remove consecutive duplicate clicks, filter noise
    const cleaned = dedupeSteps(recordedSteps);

    const recipe = {
      steps:     cleaned,
      recordedAt: new Date().toISOString(),
      url:       window.location.href,
      stepCount: cleaned.length
    };

    chrome.storage.local.set({ [RECIPE_KEY]: recipe }, function() {
      setStatus(`✅ Recorded ${cleaned.length} steps!`, '#00e5a0');
      setTimeout(updateOverlay, 2000);
    });
  }

  function dedupeSteps(steps) {
    // Remove duplicates within 200ms (accidental double-clicks)
    // Remove our own UI clicks
    return steps.filter(function(s, i) {
      if (i === 0) return true;
      const prev = steps[i-1];
      if (s.action === prev.action && s.text === prev.text && (s.ts - prev.ts) < 200) return false;
      return true;
    });
  }

  // ── REPLAY ─────────────────────────────────────────────────────────────
  function startReplay() {
    chrome.storage.local.get([RECIPE_KEY, FILE_KEY, NAME_KEY], function(r) {
      if (chrome.runtime.lastError || !r[RECIPE_KEY] || !r[FILE_KEY]) {
        setStatus('❌ Missing recipe or file.', '#ff9500');
        return;
      }

      // Reconstruct file from base64
      try {
        const base64  = r[FILE_KEY];
        const byteStr = atob(base64);
        const bytes   = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        const blob    = new Blob([bytes], { type: 'application/vnd.ms-excel' });
        replayFile    = new File([blob], r[NAME_KEY] || 'S_listing_price_update.xls', { type: 'application/vnd.ms-excel' });
      } catch(e) {
        setStatus('❌ Could not read price file: ' + e.message, '#ff4444');
        return;
      }

      replaying  = true;
      replayStep = 0;
      const recipe = r[RECIPE_KEY];

      setStatus(`🚀 Replaying ${recipe.steps.length} steps...`, '#00e5a0');
      executeStep(recipe.steps, 0);
    });
  }

  function executeStep(steps, idx) {
    if (!replaying || idx >= steps.length) {
      replaying = false;
      setStatus('✅ Upload complete!', '#00e5a0');
      setTimeout(updateOverlay, 3000);
      return;
    }

    const step = steps[idx];
    const delay = idx === 0 ? 500 : 1200; // natural pacing

    setTimeout(function() {
      setStatus(`Step ${idx+1}/${steps.length}: ${step.action} — ${step.text || step.action}`, '#ffd60a');

      try {
        if (step.action === 'click') {
          replayClick(step);
        } else if (step.action === 'file_input') {
          replayFileInput(step);
        }
      } catch(e) {
        console.warn('[BBP Replay] Step failed:', e.message);
      }

      executeStep(steps, idx + 1);
    }, delay);
  }

  function replayClick(step) {
    // Try to find element by multiple strategies, most specific first
    let el = null;

    // 1. By ID
    if (step.id) el = document.getElementById(step.id);

    // 2. By text content match
    if (!el && step.text) {
      const all = document.querySelectorAll('button, a, [role="button"], [role="menuitem"], span, div');
      for (const candidate of all) {
        const txt = (candidate.innerText || candidate.textContent || '').trim();
        if (txt === step.text || txt.startsWith(step.text.slice(0, 20))) {
          el = candidate;
          break;
        }
      }
    }

    // 3. Partial text match fallback
    if (!el && step.text && step.text.length > 4) {
      const all = document.querySelectorAll('button, a, [role="button"]');
      for (const candidate of all) {
        const txt = (candidate.innerText || candidate.textContent || '').trim().toLowerCase();
        if (txt.includes(step.text.toLowerCase().slice(0, 15))) {
          el = candidate;
          break;
        }
      }
    }

    if (el) {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
      el.click();
      el.dispatchEvent(new MouseEvent('click',     { bubbles: true }));
      console.log('[BBP Replay] Clicked:', step.text || step.tag);
    } else {
      console.warn('[BBP Replay] Element not found for:', step.text);
    }
  }

  function replayFileInput(step) {
    if (!replayFile) return;

    // Find file input
    let input = null;
    if (step.id) input = document.getElementById(step.id);
    if (!input) input = document.querySelector('input[type="file"]');

    if (input) {
      const dt = new DataTransfer();
      dt.items.add(replayFile);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input',  { bubbles: true }));
      console.log('[BBP Replay] File attached:', replayFile.name);
    } else {
      // File input not visible — click the button that triggers it
      const triggerBtn = document.querySelector('button[class*="upload" i], label[for*="file" i], [class*="file-upload"]');
      if (triggerBtn) {
        triggerBtn.click();
        setTimeout(function() {
          const inp2 = document.querySelector('input[type="file"]');
          if (inp2) {
            const dt = new DataTransfer();
            dt.items.add(replayFile);
            inp2.files = dt.files;
            inp2.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, 800);
      }
    }
  }

  function showRecipe() {
    chrome.storage.local.get([RECIPE_KEY], function(r) {
      if (!r[RECIPE_KEY]) return;
      const recipe = r[RECIPE_KEY];
      alert('Recipe recorded ' + recipe.recordedAt + '\n\n' +
        recipe.steps.map(function(s, i) {
          return (i+1) + '. ' + s.action + ' → "' + (s.text || s.action) + '"';
        }).join('\n')
      );
    });
  }

  function notify(msg) {
    const n = document.createElement('div');
    n.style.cssText = [
      'position:fixed','bottom:20px','left:50%','transform:translateX(-50%)',
      'background:#111418','border:2px solid #ff9500','border-radius:8px',
      'padding:12px 20px','z-index:2147483647','font-family:monospace',
      'font-size:13px','color:#ffd60a','box-shadow:0 4px 20px rgba(0,0,0,0.5)'
    ].join(';');
    n.textContent = '⏺ BuyBox Pro: ' + msg;
    document.body.appendChild(n);
    setTimeout(function() { if (n.parentNode) n.parentNode.removeChild(n); }, 5000);
  }

  // ── INIT ──────────────────────────────────────────────────────────────
  function init() {
    if (document.body) {
      createOverlay();
    } else {
      document.addEventListener('DOMContentLoaded', createOverlay);
    }

    // Watch for React SPA navigation
    let lastUrl = window.location.href;
    setInterval(function() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(function() {
          if (!document.getElementById('bbp-overlay')) createOverlay();
          else updateOverlay();
        }, 1500);
      }
    }, 1000);
  }

  init();
  console.log('[BuyBox Portal v2] Ready on', window.location.hostname);
})();
