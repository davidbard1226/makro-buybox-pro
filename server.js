const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
  } catch(e) {}
  return [];
}

const server = http.createServer((req, res) => {
  // API endpoint for scraper data
  if (req.url === '/api/sellers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getScraperData()));
    return;
  }

  // API endpoint to trigger scrape
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

  // Serve dashboard
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
  console.log(`Makro BuyBox Pro running at http://localhost:${PORT}`);
  console.log('Auto-refreshing scraper data every 4 hours...');
});

// Auto-refresh every 4 hours
setInterval(() => {
  console.log('Running scheduled scrape...');
  runScraper().then(() => console.log('Scrape complete'));
}, 4 * 60 * 60 * 1000);
