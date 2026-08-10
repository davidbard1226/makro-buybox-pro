var https = require('https');

var options = {
  hostname: 'www.makro.co.za',
  path: '/acer-x1128i-4800-lm-portable-projector/p/itmed614c6278d94',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
};

var req = https.request(options, function(res) {
  var chunks = [];
  res.on('data', function(c) { chunks.push(c); });
  res.on('end', function() {
    var body = Buffer.concat(chunks).toString('utf8');

    // Look for seller data in various formats
    var results = [];

    // Pattern 1: JSON with sellerName and price
    var jsonMatches = body.match(/\{[^{}]*sellerName[^{}]*\}/g);
    if (jsonMatches) results.push('JSON seller objects: ' + JSON.stringify(jsonMatches.slice(0, 5)));

    // Pattern 2: Look for "Sold By" pattern
    var soldBy = body.match(/Sold By[\s\S]{0,200}/i);
    if (soldBy) results.push('Sold By: ' + soldBy[0]);

    // Pattern 3: Look for price near seller
    var pricePattern = /R\s*[\d,]+\.?\d*\s*[\s\S]{0,100}(?:seller|Sold By|Bonolo)/gi;
    var priceMatches = body.match(pricePattern);
    if (priceMatches) results.push('Price near seller: ' + JSON.stringify(priceMatches.slice(0, 5)));

    // Pattern 4: Look for "See other sellers" link
    var sellersLink = body.match(/href="([^"]*sellers[^"]*)"/i);
    if (sellersLink) results.push('Sellers link: ' + sellersLink[1]);

    // Pattern 5: Look for any data attributes with seller info
    var dataSeller = body.match(/data-seller="([^"]+)"/i);
    if (dataSeller) results.push('Data seller: ' + dataSeller[1]);

    // Pattern 6: Look for Bonolo
    var bonolo = body.match(/Bonolo[\s\S]{0,200}/i);
    if (bonolo) results.push('Bonolo context: ' + bonolo[0].substring(0, 200));

    // Pattern 7: Look for any script with product data
    var scripts = body.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (scripts) {
      scripts.forEach(function(s) {
        if (s.includes('seller') || s.includes('price') || s.includes('offer')) {
          results.push('Script with data: ' + s.substring(0, 300));
        }
      });
    }

    console.log(results.join('\n\n'));
  });
});
req.on('error', function(e) { console.log('Error:', e.message); });
req.end();
