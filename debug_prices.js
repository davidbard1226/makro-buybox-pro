var fs = require('fs');
var html = fs.readFileSync('product_raw2.html', 'utf8');

var stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
if (!stateMatch) { console.log('No state'); process.exit(1); }

var state = JSON.parse(stateMatch[1]);
var allText = JSON.stringify(state);

// Find ALL price patterns
var patterns = [
  /"price":(\d+)/g,
  /"price":"(\d+)"/g,
  /"price":(\d+),/g,
  /"price":"(\d+)",/g,
  /price":(\d+)/g,
  /price":"(\d+)"/g,
];

patterns.forEach(function(p, idx) {
  var matches = allText.match(p);
  if (matches) {
    console.log('Pattern ' + idx + ' (' + p + '):', matches.length, 'matches');
    matches.slice(0, 5).forEach(function(m) { console.log('  ', m); });
  }
});

// Find all occurrences of "price" in the text
var priceIdx = 0;
var occurrences = [];
while ((priceIdx = allText.indexOf('"price"', priceIdx)) !== -1) {
  occurrences.push(allText.substring(priceIdx, priceIdx + 50));
  priceIdx += 7;
}
console.log('\n=== All "price" occurrences ===');
occurrences.slice(0, 20).forEach(function(o, i) {
  console.log(i + ': ' + o);
});
