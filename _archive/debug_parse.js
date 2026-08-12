// Debug the parsing
var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');

// Check if INITIAL_STATE exists
var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
console.log('State match:', stateMatch ? 'found' : 'not found');

if (stateMatch) {
  console.log('State length:', stateMatch[1].length);

  // Check for sellerCount
  var countMatch = stateMatch[1].match(/sellerCount":(\d+)/);
  console.log('Seller count match:', countMatch ? countMatch[0] : 'none');

  // Check for sellerName
  var nameMatch = stateMatch[1].match(/"sellerName":"([^"]+)"/);
  console.log('Seller name match:', nameMatch ? nameMatch[0] : 'none');

  // Check for prices
  var priceMatches = stateMatch[1].match(/"price":"(\d+)"/g);
  console.log('Price matches:', priceMatches ? priceMatches.length : 0);
  if (priceMatches) {
    priceMatches.slice(0, 10).forEach(function(p) { console.log('  ', p); });
  }
}
