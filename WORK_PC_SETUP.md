# Makro BuyBox Pro — Work PC Setup Guide

The full setup needs **3 pieces** on the work PC (same as home PC):

1. **Local server** (`server.js`) — runs on `localhost:4321`, handles price pushes
2. **Chrome extension** — scrapes makro.co.za and captures portal session cookies
3. **Dashboard** — hosted on GitHub Pages, no install needed

---

## Step 1: Install Node.js (required for the server)

1. Go to https://nodejs.org → download the **LTS** version → install (default options)
2. Verify: open PowerShell and run `node -v` — should print a version like `v20.x.x`

## Step 2: Copy the project folder to the work PC

Copy the whole `makro-buybox-pro` folder (or at minimum these files) to the work PC:

- `server.js`
- `portal-cookies.json`
- `start-server.bat`
- `start-server-silent.vbs`
- `chrome-extension\` (the whole folder)

Suggested location: `C:\makro-buybox-pro\`

## Step 3: Load the extension in Chrome

1. Open Chrome on work PC
2. Go to: `chrome://extensions`
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked**
5. Select the `chrome-extension` folder
6. **Important:** after loading, click the **↻ reload** icon on the extension once — this activates the latest code (cookies permission + session refresh)

## Step 4: Start the local server

Double-click `start-server.bat` (or run `node server.js` in the project folder).
Keep the window open — the server must be running for price pushes to work.

Verify: open `http://localhost:4321/api/costs` in Chrome — should show JSON, not an error.

## Step 5: Open the dashboard

Go to: **https://davidbard1226.github.io/makro-buybox-pro/**

## Step 6: Log into the Makro seller portal (work PC session)

1. Open a tab: **https://seller.makro.co.za**
2. Log in with your seller account
3. Leave the tab open

> The portal session cookie (`connect.sid`) is tied to each PC's browser.
> The home-PC cookies will NOT work on the work PC — you must capture fresh
> ones on the work PC (next step).

## Step 7: Refresh portal session (capture work-PC cookies)

1. On the dashboard, click **🔄 Refresh Portal Session** (top-right)
2. Log should show: `✅ Portal session refreshed`
3. This saves the work-PC cookies to `portal-cookies.json` so pushes work

## Step 8: Transfer your data from home PC

1. **Home PC:** Dashboard → Analytics tab → ⬇ Export All Data (JSON)
2. Copy the JSON file (email / USB / Google Drive)
3. **Work PC:** Dashboard → Analytics tab → ⬆ Import Data (JSON)
4. All products, price history and listings transfer in one click

## Step 9: Scraping on work PC

- Paste your Makro URLs in the Scraper tab
- Click Start Scraping
- A dedicated Chrome window opens and auto-browses each product
- Progress shows live on dashboard

---

## Keeping the work PC up to date

When the dashboard or extension gets updates:

1. **Dashboard:** nothing to do — it's hosted on GitHub Pages, always current
2. **Extension:** copy the new `chrome-extension` folder to the work PC, then
   `chrome://extensions` → click **↻ reload** on the extension
3. **Server:** copy the new `server.js` + `portal-cookies.json`, restart the
   server (close the window, run `start-server.bat` again)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Push fails with `SESSION EXPIRED` | Log into seller.makro.co.za, click 🔄 Refresh Portal Session |
| `localhost:4321` won't open | Server not running — start `start-server.bat` |
| Extension not responding | `chrome://extensions` → reload the extension |
| Dashboard shows no data | Import your JSON export from home PC (Step 8) |