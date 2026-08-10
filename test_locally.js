// Test the content script logic locally against the raw HTML
var fs = require('fs');
var html = fs.readFileSync('olivetti_raw.html', 'utf8');

console.log('=== TESTING CONTENT SCRIPT LOGIC ===');
console.log('HTML length:', html.length);

// Simulate DOMParser (not available in Node, so use regex)
var parser = {
  parseFromString: function(html, type) {
    return {
      body: { innerText: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }
    };
  }
};

// Test 1: Find seller name
var sellerMatch = html.match(/id="sellerName"[^>]*>([^<]+)</);
console.log('\n1. Seller name:', sellerMatch ? sellerMatch[1].trim() : 'NOT FOUND');

// Test 2: Find price
var priceMatches = html.match(/R\s*[\d,]+\.\d{2}/g);
console.log('\n2. Prices found:');
if (priceMatches) {
  priceMatches.slice(0, 10).forEach(function(p) {
    var val = parseFloat(p.replace(/[R\s,]/g, ''));
    if (val > 100) console.log('  ', p, '-> R', val.toFixed(2));
  });
}

// Test 3: Find PID
var pidMatch = html.match(/sellers\?pid=([A-Z0-9]{10,30})/i);
console.log('\n3. PID:', pidMatch ? pidMatch[1] : 'NOT FOUND');

// Test 4: Find "See other sellers" link
var seeOtherMatch = html.match(/href="([^"]*sellers[^"]*)"/i);
console.log('\n4. Sellers link:', seeOtherMatch ? seeOtherMatch[1].substring(0, 100) : 'NOT FOUND');

// Test 5: Parse sellers from HTML (simulated)
var text = html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n');
var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 1; });

var sellers = [];
var currentSeller = '';

for (var i = 0; i < lines.length; i++) {
  var line = lines[i];

  // Price: R X,XXX.00
  var priceMatch = line.match(/R\s*([\d,]+\.\d{2})/);
  if (priceMatch) {
    var price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (price > 100 && price < 1000000 && currentSeller) {
      sellers.push({ name: currentSeller, price: price });
      console.log('\n5. Found seller:', currentSeller, 'R', price.toFixed(2));
      currentSeller = '';
    }
  } else if (line.length > 2 && line.length < 40 &&
             !line.match(/add to cart|buy now|delivery|shipping|warranty|review|see other|sold by|sort by|filter|price|total|checkout|stock|available|free|discount|off|all sellers|seller|warranty|read more|share|select|change|help|contact|about|careers|competitions|follow|terms|privacy|policy|returns|payments|store|finder|catalogues|login|cart|home|search|sort/i)) {
    currentSeller = line;
  }
}

console.log('\n=== RESULT ===');
console.log('Sellers found:', sellers.length);
sellers.forEach(function(s, i) {
  console.log((i+1) + '.', s.name, '- R', s.price.toFixed(2));
});
