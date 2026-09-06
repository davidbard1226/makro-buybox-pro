# Restore Point — 2026-09-06 (Winning Beast: API Fast-Track + Auto-Push Reliability)

**Status: ✅ VERIFIED LIVE** (commit `77d604e` deployed to GitHub Pages, extension v5.6)

This is the **current** restore point, superseding `restore-point-2026-09-05-222150-api-fasttrack`.
It is the fully working "winning beast" state: fast API batch scraping (138+ products, no page loads),
instant live auto-push to the Makro Seller Portal, one-click fast-track list management, and no
self-inflicted repeated-failure loops.

## How to restore
- **Files backup:** copy everything from `_backups/restore-point-2026-09-06-171122-winning-beast/` back into the repo root.
  - `index.html` → repo root
  - `background.js` → `chrome-extension/background.js`
  - `bridge.js` → `chrome-extension/bridge.js`
  - `content.js` → `chrome-extension/content.js`
- **Git:** `git checkout restore-point-2026-09-06-winning-beast` (or `git reset --hard restore-point-2026-09-06-winning-beast`)
- **Extension:** copy the `chrome-extension` folder to the loaded-folder location → `chrome://extensions` → reload ↻. Manifest must show **version 5.6**.

## What's included (commit 77d604e)
1. **⚡ API fast-track batch scrape** — 138+ products scraped in ~20s/cycle via the sellers API (no page loads, concurrency capped at 8). Posts `fasttrack_api_progress` per item, one `fasttrack_api_done`.
2. **🚀 Instant live auto-push** — `maybeAutoPushPrices()` calls `doPush(withSku)` directly, never gated behind the session-refresh ceremony. First batches: `59 ok, 18 failed` / `50 ok, 17 failed` (failures all correct REFUSED-to-RAISE guards).
3. **⏭ Unwinnable guard** — if floor-clamped target price > buybox, the product is skipped entirely (no pending, no push attempt) instead of re-queuing doomed pushes every cycle. Kills the `0 ok, 17 failed` loop.
4. **🗑 Clear fast-track button** — clears `bbp_fasttrack`, persists to chrome.storage, stops the timer.
5. **⚡ Single-product fast-track add unrestricted** — the obsolete 25-product bot-protection confirm dialog removed; ⚡ on any product row adds instantly at any list size.
6. **v5.6 extension hardening** — `dispatchBatch` (re)injects content.js before dispatching, retries injection/sendMessage 3× with 1s gaps; auto-created Makro tab wait extended to 40×500ms (20s) with up to 4 homepage reloads on bot challenge. Fixed `makro_tab_not_ready`.
7. Everything from `restore-point-2026-09-05-222150-api-fasttrack` (API fast-track, bulk add ⭐/➕, seller/status filters) and earlier restore points (cost sync, SKU↔FSN matching, push portal, live pulls).

## Verified live
- Live dashboard: https://davidbard1226.github.io/makro-buybox-pro/ (hard-refresh Ctrl+Shift+R, GitHub Pages caches 10 min)
- User logs 16:15–16:19: 138 products scraped per cycle; auto-push batches `59 ok, 18 failed` and `50 ok, 17 failed`; unwinnable loop cause identified and fixed.
- User confirmed extension reloaded on v5.6 and the system "is actually running as we speak".
- Google Sheet cost sync verified reachable: DCC tab returns 707 SKUs (HTTP 200).

## Key numbers
- `index.html` = ~630 KB (~12,572 lines)
- Extension manifest **5.6** (`nloplgbpcfnjdkefhklbljbfnaiagfhm`)
- Commits: `77d604e` (this restore point) → `d4bafac` → `93e5d44` → `8bd9d1f` → `6d4563c` → `7f00203` → `60c6be5` → `12ce849`
- Git tag: `restore-point-2026-09-06-winning-beast` (current)