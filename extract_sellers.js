var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');

// Extract window.__INITIAL_STATE__
var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (stateMatch) {
  var state = JSON.parse(stateMatch[1]);

  // Navigate to seller data
  var sellerData = state.pageDataV4.page.data;

  // Find all seller-related data
  console.log('=== Seller Data ===');

  // 1. Current seller info
  var sellerWidget = sellerData['10005'] && sellerData['10005'][0];
  if (sellerWidget) {
    console.log('Current seller:', sellerWidget.widget && sellerWidget.widget.data && sellerWidget.widget.data.SellerMetaValue && sellerWidget.widget.data.SellerMetaValue.value && sellerWidget.widget.data.SellerMetaValue.value.name);
    console.log('Seller URL:', sellerWidget.widget && sellerWidget.widget.footer && sellerWidget.widget.footer.action && sellerWidget.widget.footer.action.url);
  }

  // 2. Find all seller IDs
  var allText = JSON.stringify(state);
  var sellerIds = allText.match(/sellerId["']?\s*[:=]\s*["']?([a-z0-9]+)/g);
  if (sellerIds) {
    console.log('\n=== Seller IDs ===');
    sellerIds.forEach(function(id) { console.log(id); });
  }

  // 3. Find seller count
  var countMatch = allText.match(/sellerCount["']?\s*:\s*(\d+)/g);
  if (countMatch) {
    console.log('\n=== Seller Count ===');
    countMatch.forEach(function(c) { console.log(c); });
  }

  // 4. Find all pricing data
  var priceMatches = allText.match(/["']?price["']?\s*:\s*["']?R?([\d,]+)/g);
  if (priceMatches) {
    console.log('\n=== Prices ===');
    priceMatches.slice(0, 20).forEach(function(p) { console.log(p); });
  }

  // 5. Find seller names
  var nameMatches = allText.match(/sellerName["']?\s*:\s*["']([^"']+)["']/g);
  if (nameMatches) {
    console.log('\n=== Seller Names ===');
    nameMatches.forEach(function(n) { console.log(n); });
  }

  // 6. Look for the sellers page data
  var sellersPage = state.sellersPage || state.sellers || state.offersPage;
  if (sellersPage) {
    console.log('\n=== Sellers Page Data ===');
    console.log(JSON.stringify(sellersPage).substring(0, 2000));
  }

  // 7. Look for offers data
  var offers = state.offers || state.productOffers;
  if (offers) {
    console.log('\n=== Offers Data ===');
    console.log(JSON.stringify(offers).substring(0, 2000));
  }
}
