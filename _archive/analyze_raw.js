var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');
console.log('Length:', html.length);

// Find Bonolo
var idx = html.indexOf('Bonolo');
if (idx > -1) {
  console.log('\n=== Bonolo context ===');
  console.log(html.substring(Math.max(0, idx - 300), idx + 500));
}

// Find all prices
var prices = html.match(/R\s*[\d,]+\.?\d{2}/g);
console.log('\n=== Prices ===');
console.log(prices ? prices.slice(0, 30) : 'none');

// Find script tags with seller data
var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
var match;
var found = [];
while ((match = scriptRegex.exec(html)) !== null) {
  var content = match[1];
  if (content.length > 200 && (content.includes('seller') || content.includes('Seller') || content.includes('offer') || content.includes('Offer') || content.includes('price') || content.includes('Price'))) {
    found.push(content.substring(0, 1000));
  }
}
console.log('\n=== Scripts with seller data ===');
found.slice(0, 5).forEach(function(s, i) {
  console.log('\n--- Script ' + i + ' ---');
  console.log(s);
});

// Find JSON-LD
var jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
if (jsonLd) {
  console.log('\n=== JSON-LD ===');
  jsonLd.forEach(function(j) { console.log(j.substring(0, 500)); });
}
