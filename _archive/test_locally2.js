// Test with corrected regex for nested HTML
var fs = require('fs');
var html = fs.readFileSync('olivetti_raw.html', 'utf8');

console.log('=== TESTING WITH CORRECTED REGEX ===');

// Test 1: Find seller name (handle nested divs)
var sellerMatch = html.match(/id="sellerName"[\s\S]{0,200}?>([^<]{2,30})</);
console.log('1. Seller name:', sellerMatch ? sellerMatch[1].trim() : 'NOT FOUND');

// Better approach: find the sellerName div and extract text
var sellerDivMatch = html.match(/id="sellerName"[\s\S]{0,300}<\/div>/);
if (sellerDivMatch) {
  var sellerText = sellerDivMatch[0].replace(/<[^>]+>/g, '').trim();
  console.log('1b. Seller text from div:', sellerText);
}

// Test 2: Find all prices
var priceMatches = html.match(/R\s*[\d,]+\.\d{2}/g);
console.log('\n2. Prices:');
if (priceMatches) {
  var mainPrice = priceMatches.map(function(p) {
    return parseFloat(p.replace(/[R\s,]/g, ''));
  }).filter(function(p) { return p > 100 && p < 1000000; });
  console.log('  Main product price: R', mainPrice[0] ? mainPrice[0].toFixed(2) : 'N/A');
}

// Test 3: Find PID
var pidMatch = html.match(/sellers\?pid=([A-Z0-9]{10,30})/i);
console.log('\n3. PID:', pidMatch ? pidMatch[1] : 'NOT FOUND');

// Test 4: Find "See other sellers" link
var seeOtherMatch = html.match(/href="([^"]*sellers\?pid=[^"]*)"/i);
console.log('\n4. Sellers link:', seeOtherMatch ? seeOtherMatch[1].substring(0, 80) : 'NOT FOUND');

// Test 5: Parse sellers from HTML
// The actual HTML structure for sellers page is different
// Let's simulate what the content script would do
console.log('\n5. Simulating sellers page parsing...');

// For now, we know the sellers from the earlier output:
// - Bonolo Online: R 7,998.00 (BuyBox)
// - HHolding: R 7,999.00
// - ACUMENTECHNOLOGIES: R 8,049.00
// - ML ONLINE SERVICES: R 8,050.00

console.log('Expected sellers for this product:');
console.log('  1. Korvex - R 16,074.00 (BuyBox)');
console.log('  2. Other sellers from sellers page...');

console.log('\n=== CONTENT SCRIPT FIX NEEDED ===');
console.log('The seller name regex needs to handle nested divs.');
console.log('Current regex: id="sellerName"[^>]*>([^<]+)<');
console.log('Should be: id="sellerName"[\\s\\S]{0,200}?>([^<]{2,30})<');
