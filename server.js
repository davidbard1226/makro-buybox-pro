const http = require('http');
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
