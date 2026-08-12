var fs = require('fs');
var html = fs.readFileSync('product_curl.html', 'utf8');
console.log('Length:', html.length);

// Find Bonolo
var bonoloIdx = html.indexOf('Bonolo');
if (bonoloIdx > -1) {
  console.log('\n=== Bonolo context ===');
  console.log(html.substring(Math.max(0, bonoloIdx - 200), bonoloIdx + 300));
}

// Find sellers link
var sellersLink = html.match(/sellers\?[^"&]*/i);
if (sellersLink) console.log('\nSellers link:', sellersLink[0]);

// Find all prices (R followed by numbers)
var prices = html.match(/R\s*[\d,]+\.?\d*/g);
console.log('\nAll prices:', prices ? prices.slice(0, 30) : 'none');

// Find script tags with JSON
var scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
if (scripts) {
  scripts.forEach(function(s, i) {
    if (s.length > 100 && (s.includes('seller') || s.includes('offer') || s.includes('Seller') || s.includes('Price'))) {
      console.log('\n=== Script ' + i + ' with data ===');
      console.log(s.substring(0, 800));
    }
  });
}

// Look for any JSON-LD
var jsonLd = html.match(/application\/ld\+json[^>]*>([^<]+)</g);
if (jsonLd) {
  jsonLd.forEach(function(j) {
    console.log('\n=== JSON-LD ===');
    console.log(j.substring(0, 500));
  });
}
