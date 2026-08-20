# Makro BuyBox Pro — Project Briefing
Paste this entire file at the start of any new chat to resume instantly.

## What This Project Is
A Chrome extension + dashboard that monitors and automatically wins the BuyBox on Makro (makro.co.za) for seller BonoloOnline. It scrapes competitor prices, auto-reprices products, and uploads price files to the Makro seller portal.

## File Locations
- Main dashboard: C:\Users\David\makro-buybox-pro\index.html (single HTML file, all JS inline)
- Chrome extension: C:\Users\David\makro-buybox-pro\chrome-extension\
  - background.js — scrape queue, parallel tabs
  - bridge.js — connects extension to dashboard via postMessage
  - content.js — scrapes individual Makro product pages
- GitHub: https://github.com/davidbard1226/makro-buybox-pro
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/

## How It Works
1. Extension scrapes Makro product pages for BuyBox price + seller
2. Dashboard auto-reprices: beat competitor by R1, never below min price
3. Min price = cost + Makro fees (10% commission + delivery) + 7% profit
4. Max price = min price x 1.20
5. Generates XLS price update file uploaded to Makro seller portal
6. Auto-scrape runs every 1 hour, losses scraped first (smart mode)

## Key Settings (Scraper Tab)
- Parallel tabs: 5 (max speed ~750 products/hour)
- Auto-scrape: Every 1 hour, Smart mode (losses first then wins)
- Min profit: 7% after Makro fees
- Alerts: Telegram (bot token + chat ID in localStorage)

## Makro Fee Structure
- Commission: 10% of selling price
- Delivery: under R1500=R50, R1500-R3000=R120, over R3000=R200
- Min price formula: ((1 + profitPct) x cost + deliveryFee) / 0.90

## Data Storage (browser localStorage)
- makro_buybox_v2 — products array
- makro_listings — imported listings (fsn, sku, myPrice, myStock)
- makro_deleted — deleted product blocklist
- makro_price_log — price change history
- tg_token, tg_chat_id, tg_enabled — Telegram settings
- scrape_parallel, min_profit_pct, auto_scrape_interval, auto_scrape_mode

## Current Status (August 2026)
- 1000+ products tracked, ~450 wins, ~550 losses
- Auto-scrape hourly, 5 tabs, losses-first order
- Price file generation and portal upload working (auto-push in Korvex mode)
- Telegram alerts set up
- FSN deduplication and deleted product blocklist active
- autoReprice recalculates min price fresh from cost on every run
- Lost-buybox chase: re-scrapes lost URLs after each cycle (max 3 rounds, 45s delay)
- Korvex price-pattern tracker (bbp_korvex_history, 200 obs/FSN cap)
- WIN-at-LOSS price raise is now OPT-IN (bbp_raise_wins, default OFF) — raising a
  winning price flipped us WIN→LOSE, so by default we keep the box and beat by R1
- Storage watchdog (pruneStorage) trims logs/history near the 5MB ceiling so
  SKU/cost data persists across scrape runs; portal file cleared after send
- SKU persistence FIXED (commit 05e8ad6): real SKUs survive scrape cycles; itm-slug
  SKUs are rejected and real SKUs backfilled from listings by FSN prefix
- PUSH REJECTION FIX (in-place XLS patcher): Makro's PRICING_STOCK feed rejects
  files rebuilt via SheetJS ("Error in 480/480 rows" — REAL, not cosmetic). New
  patchXlsPrices() binary-patches only the price cells inside the ORIGINAL exported
  file (NUMBER/RK/MULRK BIFF records via CFB), so every other byte is identical to
  the export Makro gave us. Verified by re-parsing; falls back to the old rebuild
  if the patch can't be verified. Filename stamp fixed to YYMM-HHMMSS (matches
  original _2008-164406_default pattern). Push log now shows "[patched N cell(s)
  in-place (X→Y bytes)]" or "[REBUILT via SheetJS ...]" so you can see which path ran.

## Known Watch Points
- Blank dashboard = JS syntax error, revert with: git checkout <last_good_commit> -- index.html
- Deleted products stay deleted via makro_deleted blocklist in localStorage + chrome.storage
- itm... SKUs auto-stripped on load (old scraper bug)
- Min price always recalculated from cost before repricing
- localStorage caps at ~5MB — if the red "Storage full" banner appears, download a
  backup (💾 Backup tab) and free space; pruneStorage runs automatically on load
- bbp_raise_wins toggle lives in Price Updater settings ("Raise winning prices")
- If a push still shows "REBUILT via SheetJS" in the log, the in-place patch failed
  (e.g. price cell stored as a formula, or file not OLE2/BIFF) — re-import the
  S_listing XLS from the Products tab and retry
- The dashboard's stored myPrice can drift ~R2 from Makro's actual price (import
  rounding) — the portal listing is the source of truth for what actually landed

## Development Workflow
1. Edit C:\Users\David\makro-buybox-pro\index.html
2. git add -A && git commit -m description && git push
3. GitHub Pages deploys in ~1 minute
4. Reload extension at chrome://extensions after changing background.js or bridge.js

## Next Features Planned
1. Auto-generate and download price XLS after every scrape cycle
2. Auto-upload to Makro portal for fully hands-off hourly repricing
