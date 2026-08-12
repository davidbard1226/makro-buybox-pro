const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4323;
const SCRAPER_DIR = 'C:/Users/David/OpenCodeProjects/makro-buybox-tracker';

// Read scraper data
function getScraperData() {
  try {
    const file = path.join(SCRAPER_DIR, 'data', 'latest.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch(e) {
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

  // Serve index.html
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Dashboard with scraper data: http://localhost:${PORT}`);
});
