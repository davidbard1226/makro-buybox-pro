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

    // Get current seller name
    var nameMatch = allText.match(/"sellerName":"([^"]+)"/);
    var currentSeller = nameMatch ? nameMatch[1] : 'Unknown';

    // Get all prices - handle both formats: "price":799800 and "price":"799900"
    var priceMatches = allText.match(/"price"[:=](\d+|"\d+")/g);
    var prices = [];
    if (priceMatches) {
      priceMatches.forEach(function(p) {
        var m = p.match(/price"[:=]"?(\d+)"?/);
        if (m) {
          var val = parseInt(m[1]);
          // Filter to product prices (R100 - R100,000)
          if (val > 10000 && val < 10000000) {
            prices.push(val);
          }
        }
      });
    }

    // Remove duplicates and sort
    prices = [...new Set(prices)].sort(function(a, b) { return a - b; });

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

console.log('Sellers found:', sellers.length);
sellers.forEach(function(s, idx) {
  console.log((idx+1) + '. ' + s.name + ' - R ' + s.price.toFixed(2) + (s.isBuyBox ? ' (BUYBOX)' : ''));
});
