const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// NOTE: index.html has this exact port hardcoded in its fetch() call for
// auto-loading scraper data (search 'localhost:4321' in index.html), so
// this server must stay on 4321. The standalone makro-buybox-tracker's own
// server.js has been moved to 4322 to avoid the collision.
const PORT = 4321;
const SCRAPER_DIR = 'C:/Users/David/OpenCodeProjects/makro-buybox-tracker';
const DASHBOARD_DIR = __dirname;

// Run scraper and get data
function runScraper() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['track.js'], { cwd: SCRAPER_DIR });
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', () => resolve(output));
  });
}

// Read latest scraper data
function getScraperData() {
  try {
    const file = path.join(SCRAPER_DIR, 'data', 'latest.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.log('Error reading scraper data:', e.message);
  }
  return [];
}

// Read portal cookies from config file
function getPortalCookies() {
  try {
    const file = path.join(__dirname, 'portal-cookies.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('portal-cookies.json not found — copy portal-cookies.example.json and fill in your cookies');
  }
}

// Push a single price to Makro Seller Portal API
function pushPriceToPortal(fsn, sku, sellingPrice, mrp) {
  return new Promise((resolve, reject) => {
    const config = getPortalCookies();
    const payload = JSON.stringify({
      listingUpdate: {
        [sku]: {
          product_id: fsn,
          price: {
            mrp: mrp,
            selling_price: sellingPrice,
            currency: 'INR'
          }
        }
      },
      priceRecoUpdate: {}
    });

    const qs = 'warningConfirmed=false&userName=' + encodeURIComponent(config.userName || 'Bonolo Online');
    const options = {
      hostname: 'seller.makro.co.za',
      path: '/napi/listing/updateSellingPrice?' + qs,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'FK-CSRF-TOKEN': config.csrfToken,
        'X-LOCATION-ID': config.locationId || '',
        'x-seller-id': config.sellerId,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://seller.makro.co.za',
        'Referer': 'https://seller.makro.co.za/index.html',
        'Cookie': config.cookies
      }
    };

    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json[sku] && json[sku].status === 'SUCCESS') {
            console.log(`[PricePush] ✅ ${sku} (FSN: ${fsn}) → R${sellingPrice}`);
            resolve({ sku, fsn, price: sellingPrice, result: json });
          } else {
            console.log(`[PricePush] ❌ ${sku}:`, data);
            reject(new Error(data));
          }
        } catch (e) {
          reject(new Error('Invalid response: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  // API: Get sellers data
  if (req.url === '/api/sellers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getScraperData()));
    return;
  }

  // API: trigger a scrape on demand (does NOT run on an internal timer —
  // scheduling is handled by the Windows Task Scheduler task already set up,
  // so we don't duplicate that here and double up requests to Makro)
  if (req.url === '/api/scrape') {
    runScraper().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, data: getScraperData() }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // API: Push price to Makro Seller Portal (single product)
  // POST /api/push-price  body: { fsn, sku, price, mrp }
  if (req.url === '/api/push-price' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { fsn, sku, price, mrp } = JSON.parse(body);
        if (!fsn || !sku || !price) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Missing fsn, sku, or price' }));
          return;
        }
        pushPriceToPortal(fsn, sku, price, mrp || price)
          .then(result => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, ...result }));
          })
          .catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // API: Batch push prices to Makro
  // POST /api/push-prices  body: [{ fsn, sku, price, mrp }, ...]
  if (req.url === '/api/push-prices' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const items = JSON.parse(body);
        if (!Array.isArray(items) || !items.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Expected non-empty array' }));
          return;
        }
        const results = [];
        for (const item of items) {
          try {
            const r = await pushPriceToPortal(item.fsn, item.sku, item.price, item.mrp || item.price);
            results.push({ fsn: item.fsn, ok: true, ...r });
          } catch (e) {
            results.push({ fsn: item.fsn, ok: false, error: e.message });
          }
          // Small delay between requests
          await new Promise(r => setTimeout(r, 600));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, results, total: items.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // API: Update portal cookies (when they expire)
  // POST /api/portal-cookies  body: { csrfToken, cookies, ... }
  if (req.url === '/api/portal-cookies' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const cookieFile = path.join(__dirname, 'portal-cookies.json');
        const existing = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
        const updated = { ...existing, ...data };
        fs.writeFileSync(cookieFile, JSON.stringify(updated, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: Run a PowerShell command (for price push)
  // GET /api/run-ps?cmd=<powershell command>
  if (req.url.startsWith('/api/run-ps')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const cmd = urlObj.searchParams.get('cmd');
    if (!cmd) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Missing cmd parameter' }));
      return;
    }
    const proc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-Command', cmd]);
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, output: output.trim() }));
    });
    return;
  }

  // Serve dashboard + static assets
  let filePath = path.join(DASHBOARD_DIR, 'index.html');
  if (req.url !== '/') {
    filePath = path.join(DASHBOARD_DIR, req.url);
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Dashboard with scraper data: http://localhost:${PORT}`);
  console.log('Scraping is scheduled via the MakroBuyboxTracker Windows Task (every 4h) — no internal timer here.');
});
