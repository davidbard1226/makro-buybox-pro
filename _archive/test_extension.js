const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const extensionPath = path.resolve(__dirname, 'chrome-extension');
  const userDataDir = path.resolve(__dirname, '.browser-profile');

  console.log('Loading extension from:', extensionPath);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
    ],
  });

  // Wait for extension to load
  await context.waitForTimeout(2000);

  // Test 1: Product page
  console.log('\n=== TEST 1: Product Page ===');
  const page1 = await context.newPage();
  await page1.goto('https://www.makro.co.za/acer-x1128i-4800-lm-portable-projector/p/itmed614c6278d94', { waitUntil: 'networkidle' });
  await page1.waitForTimeout(5000);

  // Check what data the content script found
  const productData = await page1.evaluate(() => {
    return JSON.parse(localStorage.getItem('makro_product_data') || '{}');
  });
  console.log('Product data:', JSON.stringify(productData, null, 2));

  // Test 2: Sellers page
  console.log('\n=== TEST 2: Sellers Page ===');
  const page2 = await context.newPage();
  await page2.goto('https://www.makro.co.za/sellers?pid=PJRH9CEGFZCHYTME', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(8000);

  const sellersData = await page2.evaluate(() => {
    return JSON.parse(localStorage.getItem('makro_sellers_data') || '{}');
  });
  console.log('Sellers data:', JSON.stringify(sellersData, null, 2));

  // Also check the page content
  const pageText = await page2.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('\nPage text preview:', pageText.substring(0, 500));

  await context.close();
  console.log('\nDone!');
})();
