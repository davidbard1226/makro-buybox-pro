# Restore Point — 2026-08-14

**Status: ✅ VERIFIED WORKING — "100% perfectly" (user confirmed)**

This is the restore point for the fully-working Makro BuyBox Pro dashboard + extension.

> **Note (later same day):** a small cleanup landed on top as commit `3ab1424` — removed the
> inline seller-name list from the product cell (e.g. "The Cartridge Depo Pty Ltd R5524 · ML
> ONLINE SERVICES R5525"). The cell now shows only **"N sellers · ✅ Winning / ❌ Losing"** and
> the full seller list appears on **hover** (the `.sellers-tip` card). Everything in this
> restore point still applies; the backup folder below contains the pre-cleanup working state.

## How to restore
- **Files backup:** copy everything from `_backups/restore-point-2026-08-14/` back into the repo root.
  - `index.html` → repo root
  - `chrome-extension.zip` → repo root
  - `server.js` → repo root
  - `chrome-extension/` (folder) → repo root
- **Git:** `git checkout restore-point-2026-08-14` (or `git reset --hard restore-point-2026-08-14`)
- **Extension:** unzip `chrome-extension.zip` → load unpacked in Chrome at `chrome://extensions` → reload ↻. Manifest must show **version 5.0**.

## What's included (commit 87bc12a)
1. **Sellers hover tooltip** — hovering a product's seller cell shows a floating card listing ALL sellers ranked by price, with BUYBOX badge (green, winner) and YOU badge (yellow, your seller name from Settings).
2. **Visible scrape window** — background.js forces the scrape window to the front 300ms after opening; it stays open **6 seconds** after the queue finishes before closing.
3. **Crash fixes** (earlier commits a2f9695, 6ea989f):
   - `listingsMap is not defined` in handleQueueProgress — products were being silently dropped.
   - `renderDashboard` null error on missing `#recentList`.
   - Seller names rendering as `undefined` (key is `seller`, not `sellerName`).
   - `sellers` array dropped when handleQueueProgress updated existing products.
4. **v5 internal API scraping** — `POST /fccng/api/3/page/dynamic/product-sellers` with x-user-agent header, DOM fallback.
5. **Storage fallback** — notifyDashboard saves to chrome.storage.local when no dashboard tab is reachable; bridge.js syncs to localStorage.

## Verified live
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/
- Data flow: dashboard postMessage START_QUEUE → bridge.js → background queue_scrape → openScrapeWindow → content.js page_scraped → background notifyDashboard → bridge forwards QUEUE_PROGRESS → dashboard handleQueueProgress.
- Tested URLs: Acer laptop (FSN PJRH68GWA8KENV5F, 5 sellers, ReliaStore R9155 winner), TK1160 (INTHKY79B989URPY, 2 sellers), plus real user products (Olivetti cartridges, HP LaserJet, Ink bottles) all landing with correct seller data.

## Key numbers
- `index.html` = 318,415 bytes (~6,652 lines)
- `chrome-extension.zip` = 25,115 bytes
- Extension manifest version 5.0, bridge v3.1, content.js v4 (v5 API logic inside)

## Dashboard architecture notes
- `handleQueueProgress` (~L1914) builds `listingsMap` from `getListings()`; copies `sellers: p.sellers || []`.
- Sellers cell render (~L2709+): main seller name, "N sellers · ✅ Winning / ❌ Losing" line, then `.sellers-tip` hover card (CSS at ~L92+).
- `getMySellerName()` reads `sellerNameInput` value, defaults to `'BonoloOnline'`.
- Server: PORT 4321, DASHBOARD_DIR = __dirname (NOT `public/` — that 404s).
- GitHub Pages cache max-age=600 — hard refresh (Ctrl+Shift+R) or `?v=N` to see updates.
