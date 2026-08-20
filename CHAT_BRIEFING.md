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
- PUSH REJECTION ROOT CAUSE = FILENAME STAMP, not template content: Makro validates
  the YYMM-HHMMSS stamp in the S_listing filename. Old stamps (original 2020 file
  _2008-235913_default) and the old MMDD format (_0820-142600_default) were rejected
  ("Error in 480/480 rows"); files re-stamped to today's YYMM (_2608-...) are accepted
  — proven live 2026-08-20: a single push built from the OLD 2020 template content
  landed (R30777→R30776) once the filename carried a fresh stamp, and a follow-up
  scrape confirmed ✓ WIN at R30776 (Bonolo Online holds the buybox). The dashboard
  re-stamps every generated file, so pushes work regardless of template age; a fresh
  template (Listings Management → Request Download) is still recommended for current
  data. getTemplateAgeDays() parses the stamp and warns when >30 days old.
- In-place XLS patcher (patchXlsPrices/patchBiffStream/decodeRK) binary-patches only
  the price cells inside the ORIGINAL exported file (NUMBER/RK/MULRK/LABELSST/BLANK
  BIFF records via CFB) so every other byte stays identical to the export Makro gave
  us. Verified by re-parsing; falls back to the old SheetJS rebuild if the patch can't
  be verified (failReason is logged, e.g. "REBUILT via SheetJS (in-place patch failed:
  ...)"). debugPatchXls() in the console reports file magic/CFB/record counts for
  diagnosis. Filename stamp fixed to YYMM-HHMMSS (matches original _2008-164406_default
  pattern).
- PATCHER FIXED (commit 64de06f): two root causes found on the real template
  (S_listing ..._2108-001113_default.xls, stream 819849B):
  1) BOF dt offset — BIFF8 BOF layout is version(2) dt(2) build(2); the patcher read
     dt from data[0..1] (the version 0x0600), so sheetIdx never advanced past -1 and
     the sheet0 guard blocked ALL patching ("0 cells patched"). dt now read from
     data[2..3] (0x0010 = worksheet).
  2) Prices are shared strings — Base Price (col 8) and Your Selling Price (col 9)
     cells are LABELSST (0xFD) refs to text like "3529.00", not NUMBER/RK/MULRK
     (the 1073 RK records are cols 12-20: stock counts, package dims). LABELSST and
     BLANK (0x0201) cells are now converted to NUMBER records keeping the original
     xf — the same t='n' representation the SheetJS rebuild produces, which Makro
     accepts. Verified on the real file: 25534/25536 records byte-identical, only
     the target cells converted, values re-parse correctly. Smoke suite 136/136.
- PATCHER CONFIRMED IN PRODUCTION (2026-08-20 23:27 push): log shows
  "patched 547 cell(s) in-place (840192→844288 bytes)" — the in-place patcher
  now lands on real exports instead of falling back to REBUILT. If a push log
  ever shows "REBUILT via SheetJS (in-place patch failed: 0 cells patched —
  ... 0N/0RK/0MULRK ...)" WITHOUT the LABELSST/BLANK counts, the dashboard is
  running cached pre-fix code — hard-refresh (Ctrl+Shift+R) to load the fix.

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
- STALE FILENAME STAMP = 480/480 rejection: Makro rejects S_listing files whose
  YYMM stamp is old or malformed. The dashboard re-stamps every generated file to
  today's date, so pushes work even with an old template — but re-download a fresh
  S_listing (Request Download) for current data. The dashboard warns when >30 days old.

## Development Workflow
1. Edit C:\Users\David\makro-buybox-pro\index.html
2. git add -A && git commit -m description && git push
3. GitHub Pages deploys in ~1 minute
4. Reload extension at chrome://extensions after changing background.js or bridge.js

## Next Features Planned
1. Auto-generate and download price XLS after every scrape cycle
2. Auto-upload to Makro portal for fully hands-off hourly repricing
