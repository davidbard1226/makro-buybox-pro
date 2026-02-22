# Makro BuyBox Pro Dashboard

A free, zero-maintenance dashboard for tracking your Makro buy box status.

## How it works
- Single `index.html` file hosted on **GitHub Pages** (free, always-on)
- Chrome extension scrapes product data from makro.co.za
- All data stored in `localStorage` — no backend, no server, no ngrok

## Quick Deploy (5 minutes)

1. Create a GitHub repo called `makro-buybox-pro`
2. Upload `index.html` to it  
3. Go to Settings → Pages → Deploy from main branch
4. Your dashboard is live at `https://YOUR-USERNAME.github.io/makro-buybox-pro/`

## Chrome Extension Install

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked** → select the `chrome-extension` folder
4. Pin the extension — the green dot means it's active

## Usage

1. Browse any product on makro.co.za
2. Click the extension icon → **Scrape This Page**
3. Open your dashboard to see buy box data
