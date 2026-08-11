// Sync scraper data to dashboard
// Run this after running 'node track.js' to import data into the dashboard

const fs = require('fs');
const path = require('path');

const scraperDir = 'C:/Users/David/OpenCodeProjects/makro-buybox-tracker';
const latestFile = path.join(scraperDir, 'data', 'latest.json');

if (!fs.existsSync(latestFile)) {
  console.log('ERROR: latest.json not found. Run "node track.js" first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

console.log('Latest scraper data:');
console.log('====================');
data.forEach(function(item) {
  console.log('\nProduct:', item.productName);
  console.log('PID:', item.productId);
  console.log('Buybox:', item.buyboxWinner ? item.buyboxWinner.sellerName + ' R' + item.buyboxWinner.price : 'None');
  console.log('Sellers:');
  if (item.sellers) {
    item.sellers.forEach(function(s) {
      var tag = s.selected ? ' [BUYBOX]' : '';
      console.log('  -', s.sellerName, 'R' + s.price, tag);
    });
  }
});

console.log('\n====================');
console.log('To import into dashboard:');
console.log('1. Open dashboard');
console.log('2. Click "Import Scraper Data" button');
console.log('3. Select this file:', latestFile);
console.log('\nOr copy the file to your desktop and select it from there.');
