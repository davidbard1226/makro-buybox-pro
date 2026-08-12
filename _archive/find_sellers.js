var https = require('https');
var fs = require('fs');

function fetchUrl(url) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };
    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async function() {
  // Fetch product page to get HTML with embedded data
  var product = await fetchUrl('https://www.makro.co.za/acer-x1128i-4800-lm-portable-projector/p/itmed614c6278d94');

  fs.writeFileSync('product_raw.html', product.body);
  console.log('Saved product page, length:', product.body.length);

  // Look for all script tags with JSON data
  var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
  var match;
  var sellerData = [];

  while ((match = scriptRegex.exec(product.body)) !== null) {
    var scriptContent = match[1];
    if (scriptContent.length < 50) continue;

    // Look for seller-related data
    if (scriptContent.includes('seller') || scriptContent.includes('Seller') ||
        scriptContent.includes('offer') || scriptContent.includes('Offer') ||
        scriptContent.includes('price') || scriptContent.includes('Price')) {

      // Try to find JSON objects
      var jsonMatches = scriptContent.match(/\{[^{}]*"price"[^{}]*\}/g);
      if (jsonMatches) {
        sellerData.push({ type: 'json_price', data: jsonMatches.slice(0, 10) });
      }

      // Look for Bonolo
      if (scriptContent.includes('Bonolo')) {
        sellerData.push({ type: 'bonolo', data: scriptContent.substring(0, 500) });
      }

      // Look for arrays of sellers
      var arrayMatch = scriptContent.match(/\[[\s\S]*?seller[\s\S]*?\]/i);
      if (arrayMatch) {
        sellerData.push({ type: 'array', data: arrayMatch[0].substring(0, 500) });
      }
    }
  }

  console.log('Found seller data:');
  sellerData.forEach(function(d) {
    console.log('\n--- ' + d.type + ' ---');
    console.log(d.data);
  });

  // Also look for any data attributes in HTML
  var dataAttrs = product.body.match(/data-[a-z-]*=("[^"]*"|'[^']*')/g);
  if (dataAttrs) {
    console.log('\n--- Data attributes ---');
    dataAttrs.slice(0, 30).forEach(function(attr) {
      if (attr.includes('seller') || attr.includes('price') || attr.includes('offer')) {
        console.log(attr);
      }
    });
  }

  // Look for the sellers URL pattern
  var sellersUrl = product.body.match(/sellers\?[^\"&]*/i);
  if (sellersUrl) {
    console.log('\nSellers URL:', sellersUrl[0]);
  }
})();
