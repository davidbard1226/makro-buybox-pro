var fs = require('fs');
var html = fs.readFileSync('olivetti_raw.html', 'utf8');

console.log('=== RAW HTML ANALYSIS ===');
console.log('Length:', html.length);

// Find seller-related content
var soldByIdx = html.indexOf('Sold By');
if (soldByIdx > -1) {
  console.log('\n=== Sold By context ===');
  console.log(html.substring(Math.max(0, soldByIdx - 100), soldByIdx + 300));
}

// Find price patterns
var priceMatches = html.match(/R\s*[\d,]+\.?\d*/g);
console.log('\n=== Prices found ===');
if (priceMatches) {
  priceMatches.slice(0, 15).forEach(function(p) { console.log('  ', p); });
}

// Find "See other sellers"
var seeOther = html.indexOf('See other sellers');
if (seeOther > -1) {
  console.log('\n=== See other sellers context ===');
  console.log(html.substring(Math.max(0, seeOther - 100), seeOther + 200));
}

// Find seller names (Korvex, Bonolo, etc.)
var korvexIdx = html.indexOf('Korvex');
if (korvexIdx > -1) {
  console.log('\n=== Korvex context ===');
  console.log(html.substring(Math.max(0, korvexIdx - 100), korvexIdx + 200));
}

// Find all seller-like patterns
var sellerPatterns = html.match(/[A-Z][a-z]+(?:\s[A-Z]?[a-z]+)*(?:\s(?:Online|Store|Tech|Services|Trading|Group|Holdings|Corp|Inc|Ltd))/g);
console.log('\n=== Potential seller names ===');
if (sellerPatterns) {
  var unique = [...new Set(sellerPatterns)];
  unique.slice(0, 20).forEach(function(s) { console.log('  ', s); });
}

// Find JSON-LD
var jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (jsonLd) {
  console.log('\n=== JSON-LD ===');
  console.log(jsonLd[1].substring(0, 500));
}

// Find window.__INITIAL_STATE__
var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (stateMatch) {
  console.log('\n=== INITIAL_STATE found, length:', stateMatch[1].length);
  // Search for seller data in state
  var stateStr = stateMatch[1];
  var sellerMatches = stateStr.match(/sellerName["']?\s*[:=]\s*["']?([^"'},\s]+)/g);
  if (sellerMatches) {
    console.log('Seller matches in state:');
    sellerMatches.slice(0, 10).forEach(function(m) { console.log('  ', m); });
  }
} else {
  console.log('\n=== No INITIAL_STATE found ===');
}
