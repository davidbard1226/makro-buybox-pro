# Restore Point — 2026-08-15 (Cost Sync + Auto-Match edition)

**Status: ✅ VERIFIED LIVE** (commit `f49e219` deployed to GitHub Pages)

This is the **current** restore point, superseding `restore-point-2026-08-14-push-portal`.
It adds automatic SKU/cost matching on import and per-product cost sync on top of the fully-working dashboard.

## How to restore
- **Files backup:** copy everything from `_backups/restore-point-2026-08-15-cost-sync/` back into the repo root.
  - `index.html` → repo root
  - `chrome-extension.zip` → repo root
  - `server.js` → repo root
  - `chrome-extension/` (folder) → repo root
- **Git:** `git checkout restore-point-2026-08-15-cost-sync` (or `git reset --hard restore-point-2026-08-15-cost-sync`)
- **Extension:** unzip `chrome-extension.zip` → load unpacked in Chrome at `chrome://extensions` → reload ↻. Manifest must show **version 5.0**.

## What's included (commit f49e219)
1. **💲 Per-product cost sync** — every product row now has a 💲 button (next to 🚀/📈/↻/✕) that syncs just that product's cost + min/max from the supplier Google Sheets by SKU. Shows a result alert; guards "no SKU" and "no cost found" cases.
2. **Auto cost-match on import** — importing the Makro S_listing XLS now automatically looks up cost prices from supplier sheets for every product that has a SKU, fills cost + min/max, and shows a blue banner "💲 Auto-matched cost for N product(s)". No manual 📊 Sync Costs needed after import.
3. **SKU ↔ FSN matching (both directions)** — the import already stamped SKU from the listing via FSN; now it also does the reverse: products that have a SKU but no FSN get linked to the listing's FSN when the SKU matches.
4. **Shared cost lookup engine** — `buildCostLookup()` extracted from the old bulk sync (lowest-cost-wins per SKU across all supplier tabs, fuzzy matching: case-insensitive, brand-prefix strip, variant-suffix strip). Bulk 📊 Sync Costs now reuses it. Results cached (`_costLookupCache`).
5. **🐛 Fix: init() crash** — `autoFetchScraperData`, `crossCheckAgainstTracker`, `sendCrossCheckAlert`, `importSellerData`, `importScraperData` were accidentally declared *inside* `syncCostsFromSheet` (function-scoped), so `init()` threw `ReferenceError: autoFetchScraperData is not defined` right after `loadProducts()`. Everything after that (auto-poll of localStorage, Escape-key modal close, seller-name restore, pingExtension, initAutoScrape) silently never ran. These are now global — verified live.

## What's still included (from restore-point-2026-08-14-push-portal)
- **🚀 Push to Portal (single product)** — 🚀 per row → modal: Beat BuyBox by R1 (default), Beat any seller by R1, or custom price; safety guards (min floor, max ceiling, Base Price/RRP ceiling) with auto-clamp; builds 1-row XLS from `makro_listings_raw` template (col 9 = Selling Price), sends via `SAVE_PORTAL_FILE` → bridge → chrome.storage → portal.js auto-upload; records "manual push" in history.
- **Sellers hover tooltip** — ranked list of all sellers + prices with BUYBOX/You badges.
- **Visible scrape window** — focused 300ms after open, stays 6s after queue finish.
- **v5 internal API scraping** + **storage fallback** + earlier crash fixes.

## Verified live
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/ (hard-refresh Ctrl+Shift+R, GitHub Pages caches 10 min)
- All new functions global: `buildCostLookup`, `applyCostToProduct`, `syncCostForProduct`, `autoMatchCostsAfterImport`, plus the 5 un-nested scraper helpers.
- 💲 button present on all 3 product rows (verified via DOM on live page).
- Node stubbed-DOM test: script loads with **no errors** (init fix), cost lookup finds 3/3 fake SKUs, `applyCostToProduct` 1200 → min 1591 → max 1909, `syncCostForProduct` full flow OK, no-SKU guard OK, `autoMatchCostsAfterImport` matched 2/3 and left no-SKU product untouched.

## Key numbers
- `index.html` = ~331 KB (~6,980 lines)
- `chrome-extension.zip` = 25,115 bytes, manifest **5.0**
- Commits: `f49e219` (this restore point) → `7cf8189` → `6814ef5` → `89cd3d6` → `3ab1424` → `02303f6` → `87bc12a`
- Git tags: `restore-point-2026-08-15-cost-sync` (current), `restore-point-2026-08-14-push-portal`, `restore-point-2026-08-14`
