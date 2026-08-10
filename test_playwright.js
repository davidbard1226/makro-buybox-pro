const { chromium } = require('C:/Users/David/.claude/skills/image-studio/node_modules/playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  var sellersData = [];

  // Listen for network responses to find seller data
  page.on('response', async function(response) {
    var url = response.url();
    if (url.includes('seller') || url.includes('offer') || url.includes('price')) {
      try {
        var body = await response.text();
        if (body.length > 100) {
          console.log('\n=== Response from:', url);
          console.log('Status:', response.status());
          console.log('Body preview:', body.substring(0, 1000));
        }
      } catch(e) {}
    }
  });

  // First try product page (which works)
  console.log('Navigating to product page...');
  await page.goto('https://www.makro.co.za/acer-x1128i-4800-lm-portable-projector/p/itmed614c6278d94', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  var productContent = await page.content();
  require('fs').writeFileSync('product_page_rendered.html', productContent);
  console.log('Product page length:', productContent.length);

  // Try to find seller data in product page
  var sellerElements = await page.$$('[class*="seller"], [class*="Seller"], [class*="soldBy"], [class*="SoldBy"]');
  console.log('Found', sellerElements.length, 'seller elements on product page');

  // Get the text of seller elements
  for (var i = 0; i < sellerElements.length; i++) {
    var text = await sellerElements[i].textContent();
    console.log('Seller element', i, ':', text.trim());
  }

  // Try to find the "See other sellers" link
  var sellersLink = await page.$('a[href*="/sellers"]');
  if (sellersLink) {
    var href = await sellersLink.getAttribute('href');
    console.log('Sellers link:', href);

    // Navigate to sellers page
    console.log('\nNavigating to sellers page...');
    await page.goto('https://www.makro.co.za' + href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);

    var sellersContent = await page.content();
    require('fs').writeFileSync('sellers_page_rendered.html', sellersContent);
    console.log('Sellers page length:', sellersContent.length);

    var bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n=== Sellers page text ===');
    console.log(bodyText.substring(0, 3000));
  }

  await browser.close();
})();
