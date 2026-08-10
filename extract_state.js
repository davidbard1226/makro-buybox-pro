var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');

// Extract window.__INITIAL_STATE__
var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (stateMatch) {
  try {
    var state = JSON.parse(stateMatch[1]);

    // Search for seller data in the state
    function findSellers(obj, path) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(function(item, i) { findSellers(item, path + '[' + i + ']'); });
        return;
      }
      for (var key in obj) {
        var val = obj[key];
        if (typeof val === 'string' && (val.toLowerCase().includes('seller') || val.toLowerCase().includes('bonolo') || val.toLowerCase().includes('offer'))) {
          console.log(path + '.' + key + ' = ' + val.substring(0, 200));
        } else if (typeof val === 'number' && val > 100 && val < 1000000 && (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount'))) {
          console.log(path + '.' + key + ' = R' + val);
        } else if (typeof val === 'object' && val !== null) {
          findSellers(val, path + '.' + key);
        }
      }
    }

    console.log('=== Searching for seller data in INITIAL_STATE ===');
    findSellers(state, 'state');

    // Look for product-specific data
    if (state.productPage) {
      console.log('\n=== productPage ===');
      console.log(JSON.stringify(state.productPage).substring(0, 2000));
    }

    // Look for offers/sellers
    var stateStr = JSON.stringify(state);
    var sellerMatches = stateStr.match(/seller[A-Z][a-zA-Z]*["']?\s*[:=]\s*["']?([^"'\s,}]+)/g);
    if (sellerMatches) {
      console.log('\n=== Seller matches ===');
      sellerMatches.slice(0, 20).forEach(function(m) { console.log(m); });
    }

  } catch(e) {
    console.log('Parse error:', e.message);
  }
} else {
  console.log('No __INITIAL_STATE__ found');
}
