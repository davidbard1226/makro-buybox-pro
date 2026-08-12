var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');

var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (!stateMatch) { console.log('No state found'); process.exit(1); }

var state = JSON.parse(stateMatch[1]);

// Find all unique seller IDs
var allText = JSON.stringify(state);
var idMatches = allText.match(/"sellerId":"([a-z0-9]+)"/g);
var uniqueIds = {};
if (idMatches) {
  idMatches.forEach(function(m) {
    var id = m.match(/sellerId":"([a-z0-9]+)/)[1];
    uniqueIds[id] = (uniqueIds[id] || 0) + 1;
  });
}

console.log('=== Unique Seller IDs ===');
Object.keys(uniqueIds).forEach(function(id) {
  console.log(id + ' (appears ' + uniqueIds[id] + ' times)');
});

// Find seller names
var nameMatches = allText.match(/"sellerName":"([^"]+)"/g);
console.log('\n=== Seller Names ===');
if (nameMatches) {
  nameMatches.forEach(function(n) { console.log(n); });
}

// Find all prices
var priceMatches = allText.match(/"price":"(\d+)"/g);
console.log('\n=== Prices (in cents) ===');
if (priceMatches) {
  var prices = priceMatches.map(function(p) {
    var val = parseInt(p.match(/price":"(\d+)/)[1]);
    return 'R ' + (val / 100).toFixed(2);
  });
  console.log(prices.join('\n'));
}

// Look for seller-specific data in pageDataV4
var pageData = state.pageDataV4 && state.pageDataV4.page && state.pageDataV4.page.data;
if (pageData) {
  // Look for seller list data
  for (var key in pageData) {
    var item = pageData[key];
    if (item && typeof item === 'object') {
      var itemStr = JSON.stringify(item);
      if (itemStr.includes('seller') && itemStr.includes('price')) {
        console.log('\n=== Data block ' + key + ' with seller+price ===');
        // Extract seller names and prices
        var names = itemStr.match(/"name":"([^"]+)"/g);
        var prices = itemStr.match(/"price":(\d+)/g);
        if (names) console.log('Names:', names.slice(0, 10).join(', '));
        if (prices) console.log('Prices:', prices.slice(0, 10).join(', '));
      }
    }
  }
}
