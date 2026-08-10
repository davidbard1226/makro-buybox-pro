var https = require('https');

function fetch(hostname, path) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: hostname,
      path: path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };
    var req = https.request(options, function(res) {
      var chunks = [];
      if (res.statusCode === 307 || res.statusCode === 301 || res.statusCode === 302) {
        var loc = res.headers.location;
        console.log('Redirect to:', loc);
        if (loc && loc.startsWith('http')) {
          var url = new URL(loc);
          return fetch(url.hostname, url.pathname + url.search).then(resolve).catch(reject);
        }
      }
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async function() {
  // Try product page
  console.log('=== Product Page ===');
  var product = await fetch('www.makro.co.za', '/acer-x1128i-4800-lm-portable-projector/p/itmed614c6278d94');
  console.log('Status:', product.status, 'Length:', product.body.length);

  // Save full HTML
  require('fs').writeFileSync('product_page.html', product.body);

  // Find seller data
  var html = product.body;

  // Look for Bonolo
  var bonoloIdx = html.indexOf('Bonolo');
  if (bonoloIdx > -1) {
    console.log('Bonolo context:', html.substring(Math.max(0, bonoloIdx - 100), bonoloIdx + 200));
  }

  // Look for price 7998
  var priceIdx = html.indexOf('7998');
  if (priceIdx > -1) {
    console.log('Price context:', html.substring(Math.max(0, priceIdx - 100), priceIdx + 200));
  }

  // Look for sellers link
  var sellersLink = html.match(/sellers\?[^\"&]*/i);
  if (sellersLink) console.log('Sellers link found:', sellersLink[0]);

  // Look for any JSON data
  var jsonMatches = html.match(/\{[^{}]*"price"[^{}]*\}/g);
  if (jsonMatches) console.log('JSON price objects:', jsonMatches.slice(0, 5));
})();
