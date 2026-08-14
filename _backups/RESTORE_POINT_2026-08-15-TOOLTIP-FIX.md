# Restore Point — 2026-08-15 (Sellers Tooltip Fix)

**Status: ✅ VERIFIED LIVE** (commit `0f92fd2` deployed to GitHub Pages)

This is the **current** restore point, superseding `restore-point-2026-08-15-cost-sync`.
It fixes the sellers hover tooltip so long seller lists can be scrolled and never get cut off.

## How to restore
- **Files backup:** copy everything from `_backups/restore-point-2026-08-15-tooltip-fix/` back into the repo root.
  - `index.html` → repo root
  - `chrome-extension.zip` → repo root
  - `server.js` → repo root
  - `chrome-extension/` (folder) → repo root
- **Git:** `git checkout restore-point-2026-08-15-tooltip-fix` (or `git reset --hard restore-point-2026-08-15-tooltip-fix`)
- **Extension:** unzip `chrome-extension.zip` → load unpacked in Chrome at `chrome://extensions` → reload ↻. Manifest must show **version 5.0**.

## What's included (commit 0f92fd2)
1. **🐛 Sellers hover tooltip fixed** — the user's complaint: "when I hover over buybox seller name, especially if only 1 product is found in the search, I battle to scroll down to view all seller names and price."
   - **Root cause:** `.table-wrap` has `overflow-x:auto`, which makes it a scroll container. The old tooltip was `position:absolute` inside the table cell, so it was **clipped** by the table's scroll box — long seller lists were cut off with no way to scroll.
   - **Fix:** the tooltip is now a single `#sellersTip` element appended to `document.body`, `position:fixed`, `z-index:1000`, `max-height:60vh` with `overflow-y:auto` + `overscroll-behavior:contain` — long lists scroll **inside** the card with the mouse wheel.
   - **Smart positioning** (`positionSellersTip`): prefers below the cell; flips **above** when it would overflow the viewport bottom; clamps to viewport edges.
   - **Hover persistence**: capture-phase `mouseenter`/`mouseleave` delegation on document. Moving from the cell **into** the tooltip keeps it open (so it can be scrolled); leaving the tooltip hides it; page scroll hides it.
   - Cell still shows "N sellers · ✅ Winning / ❌ Losing" summary; full ranked list (with BUYBOX/YOU badges) on hover.
2. Everything from `restore-point-2026-08-15-cost-sync` (💲 per-product cost sync, auto cost-match on import, SKU↔FSN matching, init crash fix) and `restore-point-2026-08-14-push-portal` (🚀 Push to Portal, visible scrape window, v5 API scraping, storage fallback).

## Verified live
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/ (hard-refresh Ctrl+Shift+R, GitHub Pages caches 10 min)
- Hover on HP Smart Tank cell (2 sellers): tooltip appears, `position:fixed`, `overflow-y:auto`, 2 rows, title "All sellers · 2".
- With simulated 1920×937 viewport: tooltip at 639 = cellBottom 633 + 6 (below), left-aligned with cell, fits viewport.
- Simulated cell near bottom (bottom 905): tooltip flips above (852–874), fits viewport.
- Hover state machine verified: leave cell → hides; re-enter → shows; leave cell into tooltip → stays open; leave tooltip → hides.
- Node stubbed-DOM test: script loads with no errors; tooltip created lazily, 5 rows, correct title, show/hide classes work.

## Key numbers
- `index.html` = ~331 KB (~6,967 lines)
- `chrome-extension.zip` = 25,115 bytes, manifest **5.0**
- Commits: `0f92fd2` (this restore point) → `ec79494` → `f49e219` → `7cf8189` → `6814ef5` → `89cd3d6` → `3ab1424` → `02303f6` → `87bc12a`
- Git tags: `restore-point-2026-08-15-tooltip-fix` (current), `restore-point-2026-08-15-cost-sync`, `restore-point-2026-08-14-push-portal`, `restore-point-2026-08-14`