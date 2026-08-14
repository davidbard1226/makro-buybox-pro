# Restore Point — 2026-08-14 (Push to Portal edition)

**Status: ✅ VERIFIED WORKING — "perfect it worked perfect" (user confirmed)**

This is the **current** restore point, superseding `restore-point-2026-08-14`.
It adds the major **single-product Push to Portal** feature on top of the fully-working dashboard.

## How to restore
- **Files backup:** copy everything from `_backups/restore-point-2026-08-14-push-portal/` back into the repo root.
  - `index.html` → repo root
  - `chrome-extension.zip` → repo root
  - `server.js` → repo root
  - `chrome-extension/` (folder) → repo root
- **Git:** `git checkout restore-point-2026-08-14-push-portal` (or `git reset --hard restore-point-2026-08-14-push-portal`)
- **Extension:** unzip `chrome-extension.zip` → load unpacked in Chrome at `chrome://extensions` → reload ↻. Manifest must show **version 5.0**.

## What's included (commit 6814ef5)
1. **🚀 Push to Portal (single product)** — the major new feature:
   - Every product row has a 🚀 button → opens a modal with three pricing modes:
     - **⚡ Beat BuyBox by R1** (default)
     - **🥈 Beat any specific seller by R1** — one option per seller from the hover list
     - **Custom price** — type any amount
   - Live safety guards shown: min floor, max ceiling, Base Price (RRP) ceiling — auto-clamps with warning.
   - Builds a **1-row XLS** from the imported S_listing template (col 9 = Selling Price), saves it, sends via `SAVE_PORTAL_FILE` → bridge → chrome.storage for portal.js auto-upload.
   - Records the push in the product's price history with a "manual push" note.
   - Requires the raw listing template (`makro_listings_raw`) imported first (same as bulk updater).
2. **Sellers hover tooltip** — hovering a product's seller cell shows a floating card listing ALL sellers ranked by price, with BUYBOX badge (green, winner) and YOU badge (yellow, your seller name from Settings).
3. **Cleanup** — product cell shows only "N sellers · ✅ Winning / ❌ Losing"; full seller list on hover only.
4. **Visible scrape window** — background.js forces the scrape window to the front 300ms after opening; stays open **6 seconds** after the queue finishes before closing.
5. **Crash fixes** (a2f9695, 6ea989f): listingsMap ReferenceError, recentList null error, seller names as 'undefined', sellers array dropped.
6. **v5 internal API scraping** — `POST /fccng/api/3/page/dynamic/product-sellers` with x-user-agent header, DOM fallback.
7. **Storage fallback** — notifyDashboard saves to chrome.storage.local when no dashboard tab is reachable; bridge.js syncs to localStorage.

## Verified live
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/
- Push flow tested end-to-end: Acer product (5 sellers) → "Beat ML ONLINE SERVICES by R1" → XLS row written with R9199, filename generated, file saved + sent to bridge, history recorded with "manual push" note.
- Data flow: dashboard postMessage START_QUEUE → bridge.js → background queue_scrape → openScrapeWindow → content.js page_scraped → background notifyDashboard → bridge forwards QUEUE_PROGRESS → dashboard handleQueueProgress.

## Key numbers
- `index.html` = ~318 KB (~6,890 lines)
- `chrome-extension.zip` = 25,115 bytes
- Extension manifest version 5.0, bridge v3.1, content.js v4 (v5 API logic inside)

## Dashboard architecture notes
- `handleQueueProgress` (~L1914) builds `listingsMap` from `getListings()`; copies `sellers: p.sellers || []`.
- Sellers cell render (~L2709+): main seller name, "N sellers · ✅ Winning / ❌ Losing" line, then `.sellers-tip` hover card (CSS at ~L92+).
- Push modal: `openPushModal(idx)` / `selectPushOption(id)` / `updatePushPreview()` / `pushProductToPortal()` (~L3620+). Modal HTML `#pushModal` (~L1540+).
- `getMySellerName()` reads `sellerNameInput` value, defaults to `'BonoloOnline'`.
- Server: PORT 4321, DASHBOARD_DIR = __dirname (NOT `public/` — that 404s).
- GitHub Pages cache max-age=600 — hard refresh (Ctrl+Shift+R) or `?v=N` to see updates.