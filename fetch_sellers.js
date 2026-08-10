var https = require('https');

var options = {
  hostname: 'www.makro.co.za',
  path: '/sellers?pid=PJRH9CEGFZCHYTME',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-ZA,en;q=0.9',
    'Referer': 'https://www.makro.co.za/acer-x1128i-4800-lm-portable-projector/p/itmed614c6278d94'
  }
};

var req = https.request(options, function(res) {
  var chunks = [];
  console.log('Status:', res.statusCode);
  res.on('data', function(c) { chunks.push(c); });
  res.on('end', function() {
    var body = Buffer.concat(chunks).toString('utf8');

    // Look for JSON-like data with prices
    var priceMatches = body.match(/R\s*[\d,]+/g);
    var nameMatches = body.match(/[A-Z][a-z]+(?:\s[A-Z]?[a-z]+){1,3}/g);
    var bonolo = body.match(/Bonolo[a-zA-Z\s]*/g);

    console.log('Prices found:', priceMatches ? priceMatches.slice(0,20) : 'none');
    console.log('Potential names:', nameMatches ? nameMatches.slice(0,20) : 'none');
    console.log('Bonolo:', bonolo ? bonolo.slice(0,5) : 'none');

    // Save full HTML for analysis
    require('fs').writeFileSync('sellers_page.html', body);
    console.log('Full HTML saved to sellers_page.html');
  });
});
req.on('error', function(e) { console.log('Error:', e.message); });
req.end();
