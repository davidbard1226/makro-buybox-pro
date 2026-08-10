const { chromium } = require('C:/Users/David/.claude/skills/image-studio/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const extensionPath = path.resolve(__dirname, 'chrome-extension');
  const userDataDir = path.resolve(__dirname, '.browser-profile-test');

  console.log('Launching browser with extension...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
    ],
  });

  await new Promise(r => setTimeout(r, 3000));

  const page = await context.newPage();

  // Listen for console logs from content script
  page.on('console', function(msg) {
    if (msg.text().includes('[MakroPro]')) {
      console.log('CONTENT:', msg.text());
    }
  });

  console.log('Navigating to product page...');
  await page.goto('https://www.makro.co.za/olivetti-d-copia-4024mf-multi-function-laser-printer/p/itm43853716724e0', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('Waiting for content script to scrape...');
  await new Promise(r => setTimeout(r, 15000));

  // Debug: check what's on the page
  var pageInfo = await page.evaluate(function() {
    return {
      url: window.location.href,
      title: document.title,
      sellerEl: document.getElementById('sellerName') ? document.getElementById('sellerName').textContent : 'NOT FOUND',
      bodyText: document.body.innerText.substring(0, 500)
    };
  });
  console.log('\nPage info:', JSON.stringify(pageInfo, null, 2));

  // Check localStorage
  const productData = await page.evaluate(function() {
    return JSON.parse(localStorage.getItem('makro_product_data') || '{}');
  });
  console.log('\nProduct data:', JSON.stringify(productData, null, 2));

  const sellersData = await page.evaluate(function() {
    return JSON.parse(localStorage.getItem('makro_sellers_data') || '{}');
  });
  console.log('\nSellers data:', JSON.stringify(sellersData, null, 2));

  await context.close();
  console.log('\nDone!');
})();
