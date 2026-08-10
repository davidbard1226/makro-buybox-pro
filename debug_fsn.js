// Test the OLD (original) parseBulkSkuText vs NEW (fixed)

function parseCSVLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// OLD code (from index_stable_v4.html)
function oldParseBulkSkuText(text) {
  var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  var pairs = [];
  lines.forEach(function(line) {
    var parts;
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else {
      parts = line.split(/\s{2,}/);
    }
    if (parts.length < 2) return;
    var a = parts[0].trim().replace(/^["']|["']$/g, '');
    var b = parts[1].trim().replace(/^["']|["']$/g, '');
    if (!a || !b) return;
    var looksLikeFsnA = /^[A-Z0-9]{10,24}$/.test(a);
    var looksLikeFsnB = /^[A-Z0-9]{10,24}$/.test(b);
    if (!looksLikeFsnA && !looksLikeFsnB) return;
    var sku, fsn;
    if (looksLikeFsnB && !looksLikeFsnA) { sku = a; fsn = b; }
    else if (looksLikeFsnA && !looksLikeFsnB) { sku = b; fsn = a; }
    else { sku = a; fsn = b; }
    pairs.push({ sku: sku, fsn: fsn });
  });
  return pairs;
}

// NEW code (from current index.html)
function newParseBulkSkuText(text) {
  var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  var pairs = [];
  lines.forEach(function(line) {
    var parts = parseCSVLine(line);
    if (parts.length < 2) return;
    var headerLine = lines[0] ? parseCSVLine(lines[0]) : [];
    var isMakroExport = headerLine[0] && headerLine[0].toLowerCase().includes('fsn') &&
                        headerLine[2] && headerLine[2].toLowerCase().includes('sku');
    if (isMakroExport) {
      if (lines.indexOf(line) === 0) return;
      var fsn = parts[0] ? parts[0].trim().replace(/^["'|]|["']$/g, '') : '';
      var sku = parts[2] ? parts[2].trim().replace(/^["'|]|["']$/g, '') : '';
      if (!fsn || !sku) return;
      var looksLikeFsn = /^[A-Z0-9]{10,24}$/.test(fsn);
      if (looksLikeFsn) pairs.push({ sku: sku, fsn: fsn });
      return;
    }
    var a = parts[0].trim().replace(/^["'|]|["']$/g, '');
    var b = parts[1].trim().replace(/^["'|]|["']$/g, '');
    if (!a || !b) return;
    var looksLikeFsnA = /^[A-Z0-9]{10,24}$/.test(a);
    var looksLikeFsnB = /^[A-Z0-9]{10,24}$/.test(b);
    if (!looksLikeFsnA && !looksLikeFsnB) return;
    var sku, fsn;
    if (looksLikeFsnB && !looksLikeFsnA) { sku = a; fsn = b; }
    else if (looksLikeFsnA && !looksLikeFsnB) { sku = b; fsn = a; }
    else { sku = a; fsn = b; }
    pairs.push({ sku: sku, fsn: fsn });
  });
  return pairs;
}

var csv = `"FSN","Title","SKU (fill this in)","BuyBox Price","Status","Last Checked"
"INTH4YGVRQKVQF6M","Canon PG 446 Tri Colour Ink Cartridge","CANON-446-C","439","lose","2026-03-15T18:59:18.271Z"
"PRNH5MXYQHGHZ5WK","HP 7MD67A Single Function Laser Printer","HP-MD67","3210","lose","2026-03-15T19:10:57.302Z"`;

console.log('=== OLD CODE (original) ===');
var oldResult = oldParseBulkSkuText(csv);
oldResult.forEach(function(p) {
  console.log('SKU:', JSON.stringify(p.sku), '-> FSN:', p.fsn);
});

console.log('\n=== NEW CODE (fixed) ===');
var newResult = newParseBulkSkuText(csv);
newResult.forEach(function(p) {
  console.log('SKU:', JSON.stringify(p.sku), '-> FSN:', p.fsn);
});
