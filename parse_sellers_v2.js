// Parse seller data from Makro product page HTML
function parseSellersFromProductHtml(html) {
  var sellers = [];

  var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
  if (!stateMatch) return sellers;

  try {
    var state = JSON.parse(stateMatch[1]);
    var allText = JSON.stringify(state);

    // Get seller count
    var countMatch = allText.match(/sellerCount":(\d+)/);
    var sellerCount = countMatch ? parseInt(countMatch[1]) : 0;
    console.log('Seller count:', sellerCount);

    // Get current seller name
    var nameMatch = allText.match(/"sellerName":"([^"]+)"/);
    var currentSeller = nameMatch ? nameMatch[1] : 'Unknown';
    console.log('Current seller:', currentSeller);

    // Get all prices - format is "price":799800 (number, not string)
    var priceMatches = allText.match(/"price":(\d+)/g);
    var prices = [];
    if (priceMatches) {
      console.log('Price matches found:', priceMatches.length);
      priceMatches.forEach(function(p) {
        var val = parseInt(p.match(/price":(\d+)/)[1]);
        // Filter to product prices (R100 - R100,000)
        if (val > 10000 && val < 10000000) {
          prices.push(val);
        }
      });
    }

    // Remove duplicates and sort
    prices = [...new Set(prices)].sort(function(a, b) { return a - b; });
    console.log('Filtered prices:', prices.map(function(p) { return 'R' + (p/100).toFixed(2); }).join(', '));

    // Build seller list
    prices.forEach(function(priceCents, idx) {
      var price = priceCents / 100;
      sellers.push({
        name: idx === 0 ? currentSeller : 'Seller ' + (idx + 1),
        price: price,
        shipping: 0,
        total: price,
        isBuyBox: idx === 0,
        isMyStore: idx === 0,
        rating: null
      });
    });

  } catch(e) {
    console.error('Parse error:', e.message);
  }

  return sellers;
}

// Test
var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');
var sellers = parseSellersFromProductHtml(html);

console.log('\n=== Parsed Sellers ===');
sellers.forEach(function(s, idx) {
  console.log((idx+1) + '. ' + s.name + ' - R ' + s.price.toFixed(2) + (s.isBuyBox ? ' (BUYBOX)' : ''));
});
