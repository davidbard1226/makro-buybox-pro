# Restore Point — 2026-08-15 (Page Load Fix)

**Status: ✅ VERIFIED LIVE** (commit `492f6ce` deployed to GitHub Pages)

This is the **current** restore point, superseding `restore-point-2026-08-15-tooltip-fix`.
It fixes the "loading spinner forever" problem on the GitHub Pages dashboard.

## How to restore
- **Files backup:** copy everything from `_backups/restore-point-2026-08-15-load-fix/` back into the repo root.
  - `index.html` → repo root
  - `chrome-extension.zip` → repo root
  - `server.js` → repo root
  - `chrome-extension/` (folder) → repo root
- **Git:** `git checkout restore-point-2026-08-15-load-fix` (or `git reset --hard restore-point-2026-08-15-load-fix`)
- **Extension:** unzip `chrome-extension.zip` → load unpacked in Chrome at `chrome://extensions` → reload ↻. Manifest must show **version 5.0**.

## What's included (commit 492f6ce)
1. **🐛 Fix: "loading spinner forever" on GitHub Pages** — the user reported the dashboard never finished loading (spinner forever).
   - **Root cause:** the `<head>` had two **blocking** resources:
     - Google Fonts `<link rel="stylesheet">` — blocks **first paint**; if fonts.googleapis.com is slow/blocked on the user's network, the page stays blank.
     - cdnjs xlsx `<script src>` (synchronous) — blocks the **load event**; if cdnjs hangs, the tab spinner spins forever.
   - **Fix:**
     - Google Fonts → `rel="preload" as="style" onload="this.rel='stylesheet'"` pattern + `<noscript>` fallback. Page paints immediately with fallback fonts; fonts apply when loaded.
     - xlsx → `async` + `onerror` fallback to the jsdelivr mirror. The load event never waits on cdnjs.
     - Added `ensureXLSX(cb)` helper (polls up to 15s for `window.XLSX`, then alerts) and guards at the 4 XLSX entry points: `importListings`, `pushProductToPortal`, `applyGuards`, `processBulkSkuFile` — each retries itself once the library arrives, so no race-condition errors.
2. Everything from `restore-point-2026-08-15-tooltip-fix` (global scrollable sellers tooltip), `restore-point-2026-08-15-cost-sync` (💲 per-product cost sync, auto cost-match on import, SKU↔FSN matching, init crash fix), and `restore-point-2026-08-14-push-portal` (🚀 Push to Portal, visible scrape window, v5 API scraping, storage fallback).

## Verified live
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/ (hard-refresh Ctrl+Shift+R — GitHub Pages caches 10 min)
- Head now: fonts preload+onload (rel converts to stylesheet, `as="style"`), xlsx `async: true`.
- Page load: domComplete 716ms, loadEvent 716ms (was blocked before).
- `ensureXLSX` global, `XLSX` loaded and available, fonts applied.
- Node stubbed-DOM test: script loads with no errors; all prior features (cost sync, tooltip) still pass.

## Key numbers
- `index.html` = ~331 KB (~7,053 lines)
- `chrome-extension.zip` = 25,115 bytes, manifest **5.0**
- Commits: `492f6ce` (this restore point) → `38ac40c` → `0f92fd2` → `ec79494` → `f49e219` → `7cf8189` → `6814ef5` → `89cd3d6` → `3ab1424` → `02303f6` → `87bc12a`
- Git tags: `restore-point-2026-08-15-load-fix` (current), `restore-point-2026-08-15-tooltip-fix`, `restore-point-2026-08-15-cost-sync`, `restore-point-2026-08-14-push-portal`, `restore-point-2026-08-14`