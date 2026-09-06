// Makro BuyBox Pro — Capture fresh portal cookies (run in seller.makro.co.za console)
// Paste this whole block into the portal tab's DevTools Console and press Enter.
// It copies the ready-to-save JSON to your clipboard automatically — just Ctrl+V it into the chat.
(function(){
  var out = {};
  try {
    var d = JSON.parse(localStorage.getItem('__appData') || '{}');
    out.csrfToken = (d.sellerConfig && d.sellerConfig.csrfToken) || '';
    out.sellerId  = (d.sellerConfig && d.sellerConfig.sellerId) || '';
    out.locationId = d['X-LOCATION-ID'] || '';
  } catch(e) { out.csrfToken = ''; out.sellerId = ''; out.locationId = ''; }
  out.userName = 'Bonolo Online';
  out.cookies = document.cookie || '';
  // Staleness check: the T session cookie embeds its creation timestamp (ms).
  var ageMsg = '';
  try {
    var tMatch = out.cookies.match(/(?:^|;\s*)T=TI(\d{13})/);
    if (tMatch) {
      var created = parseInt(tMatch[1], 10);
      var ageHours = (Date.now() - created) / 3600000;
      if (ageHours > 12) {
        ageMsg = '⚠ STALE SESSION: this session is ' + Math.round(ageHours) + ' hours old. Log OUT and log IN again on seller.makro.co.za, then re-run this script.';
      } else {
        ageMsg = '✓ Session looks fresh (' + Math.round(ageHours * 10) / 10 + ' h old).';
      }
    } else {
      ageMsg = '⚠ Could not read session age — if pushes fail with SESSION EXPIRED, log out and log in again first.';
    }
  } catch(e) { ageMsg = '⚠ Session age check failed.'; }
  var json = JSON.stringify(out, null, 2);
  try { copy(json); } catch(e) { }
  console.log('=== BBP COOKIE CAPTURE START ===');
  console.log(json);
  console.log('=== BBP COOKIE CAPTURE END ===');
  alert(ageMsg + '\n\nCookies copied to clipboard! Just paste here (Ctrl+V).');
})();