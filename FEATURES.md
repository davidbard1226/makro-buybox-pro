# Makro BuyBox Pro - Enhanced Features

## Changes Made

### 1. Custom Scraper Time Interval
Added the ability to set custom auto-scrape intervals beyond the preset options.

**Features:**
- New preset options: 5 minutes, 15 minutes, 30 minutes
- Custom interval option with input field (1-1440 minutes)
- Setting persists in localStorage
- Real-time display of current interval

**How to use:**
1. Go to the **Scraper** tab
2. Find the **🕐 Auto-Scrape Schedule** section
3. Select "Custom interval..." from the dropdown
4. Enter your desired interval in minutes (1-1440)
5. The setting is saved automatically

### 2. Configurable Beat Amount for Auto-Reprice
Added the ability to set how much below the BuyBox price to set your price during auto-reprice.

**Features:**
- Preset options: R1, R2, R3, R5, R10
- Custom amount option with input field (min 0.5, step 0.5)
- Setting persists in localStorage
- Applies to all auto-reprice operations after scraping
- Log messages show the configured beat amount

**How to use:**
1. Go to the **Scraper** tab
2. Find the **🎯 Auto-Reprice: Beat BuyBox by** section
3. Select your desired beat amount from the dropdown
4. For custom amounts, select "Custom..." and enter your value
5. The setting is saved automatically

## Technical Details

### Files Modified
- `index.html` - Main dashboard file

### New JavaScript Functions
1. `toggleCustomInterval(value)` - Shows/hides custom interval input
2. `applyCustomInterval(minutes)` - Applies custom interval value
3. `getAutoScrapeInterval()` - Gets the actual interval value (handles custom)
4. `saveAutoBeatAmount()` - Saves beat amount setting
5. `getAutoBeatAmount()` - Gets the configured beat amount
6. `initBeatAmount()` - Initializes beat amount from localStorage

### localStorage Keys
- `auto_scrape_interval` - Stores interval in minutes (or "custom")
- `auto_scrape_interval_custom` - Flag for custom interval
- `auto_beat_amount` - Stores beat amount in Rands

## Usage Tips

### For Faster Reactions
- Set scraper interval to **5-10 minutes** for competitive products
- Use **R2-R3 beat amount** to have a buffer against quick competitor reactions

### For Margin Protection
- Use **R1 beat amount** for tight margins
- Set **higher intervals** (30-60 minutes) to reduce price wars

### For Aggressive Competition
- Use **R5-R10 beat amount** to dominate buybox
- Set **5 minute intervals** to react instantly to competitor changes

## Notes
- All settings are saved in browser localStorage
- Settings persist across sessions
- The Price Updater tab has its own separate "Beat by" setting for manual price updates
- Auto-reprice settings only apply to automatic repricing after scraping