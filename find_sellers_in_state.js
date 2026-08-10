var fs = require('fs');
var html = fs.readFileSync('olivetti_raw.html', 'utf8');

var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (!stateMatch) { console.log('No state'); process.exit(1); }

var state = JSON.parse(stateMatch[1]);
var allText = JSON.stringify(state);

// Find all seller-related data
var sellerMatches = allText.match(/sellerName["']?\s*[:=]\s*["']?([^"'},\s]+)/g);
console.log('Seller names in state:');
if (sellerMatches) sellerMatches.forEach(function(s) { console.log('  ', s); });

// Find all prices
var priceMatches = allText.match(/"price":(\d+)/g);
console.log('\nPrices in state:');
if (priceMatches) priceMatches.slice(0, 20).forEach(function(p) { console.log('  ', p); });

// Find sellerCount
var countMatch = allText.match(/sellerCount":(\d+)/g);
console.log('\nSeller count:', countMatch ? countMatch[0] : 'none');

// Find all unique seller IDs
var idMatches = allText.match(/"sellerId":"([a-z0-9]+)"/g);
if (idMatches) {
  var unique = {};
  idMatches.forEach(function(m) {
    var id = m.match(/sellerId":"([a-z0-9]+)/)[1];
    unique[id] = (unique[id] || 0) + 1;
  });
  console.log('\nUnique seller IDs:', Object.keys(unique).length);
  Object.keys(unique).forEach(function(id) { console.log('  ', id); });
}

// Find offers/sellers data
var offersMatch = allText.match(/offers["']?\s*:\s*\[[\s\S]{0,500}/);
console.log('\nOffers data:', offersMatch ? offersMatch[0].substring(0, 300) : 'none');

// Find seller list
var sellerListMatch = allText.match(/sellers?["']?\s*:\s*\[[\s\S]{0,1000}/);
console.log('\nSeller list:', sellerListMatch ? sellerListMatch[0].substring(0, 500) : 'none');
