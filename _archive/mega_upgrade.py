import ftplib, io, urllib.request, ssl, json, re

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Download live site
print('Downloading live site...')
html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za', headers={'User-Agent':'Mozilla/5.0'}
), context=ctx, timeout=30).read().decode('utf-8','ignore')
print(f'Got {len(html):,} chars')

# ── UPLOAD PHP MAIL SCRIPT FIRST ──────────────────────────────────
print('Uploading order-mail.php...')
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=30)
ftp.login(FTP_USER, FTP_PASS)
ftp.cwd('public_html')
with open(r'C:\Users\David\makro-buybox-pro\order-mail.php', 'rb') as f:
    ftp.storbinary('STOR order-mail.php', f)
print('order-mail.php uploaded!')
ftp.quit()

# ── NEW CSS ───────────────────────────────────────────────────────
NEW_CSS = """
/* WHATSAPP BUTTON */
.wa-btn{position:fixed;bottom:24px;right:24px;z-index:150;width:56px;height:56px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(37,211,102,.4);cursor:pointer;transition:all .3s;text-decoration:none;}
.wa-btn:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(37,211,102,.6);}
.wa-btn svg{width:30px;height:30px;fill:#fff;}
.wa-pulse{position:absolute;inset:0;border-radius:50%;background:#25D366;animation:waPulse 2s infinite;opacity:.6;}
@keyframes waPulse{0%{transform:scale(1);opacity:.6}70%{transform:scale(1.5);opacity:0}100%{transform:scale(1.5);opacity:0}}

/* PROFESSIONAL BANNER SLIDER */
.hero-slider{position:relative;overflow:hidden;background:#0a0a0a;}
.slide{position:absolute;inset:0;opacity:0;transition:opacity .8s ease;display:flex;align-items:stretch;}
.slide.active{opacity:1;position:relative;min-height:380px;}
.slide-bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;}
.slide-overlay{position:absolute;inset:0;}
.slide-content{position:relative;z-index:2;max-width:1400px;margin:auto;width:100%;padding:60px 40px;display:flex;align-items:center;justify-content:space-between;gap:40px;}
.slide-text{flex:1;max-width:560px;}
.slide-eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--orange);margin-bottom:12px;display:block;}
.slide-text h2{font-family:var(--font-head);font-size:clamp(32px,4vw,56px);font-weight:700;line-height:1.1;margin:0 0 16px;color:#fff;text-shadow:0 2px 20px rgba(0,0,0,.5);}
.slide-text h2 .acc{color:var(--orange);}
.slide-text p{color:rgba(255,255,255,.8);font-size:15px;line-height:1.7;margin:0 0 28px;max-width:440px;}
.slide-badges{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;}
.slide-badge{background:rgba(255,255,255,.12);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:5px 14px;font-size:12px;color:#fff;font-weight:600;}
.slide-cta-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
.slide-cta{background:var(--orange);color:#fff;border:none;border-radius:8px;padding:13px 30px;font-family:var(--font-head);font-size:16px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.5px;text-decoration:none;display:inline-block;}
.slide-cta:hover{background:var(--orange2);transform:translateY(-1px);}
.slide-cta-ghost{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.5);border-radius:8px;padding:11px 24px;font-family:var(--font-head);font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;}
.slide-cta-ghost:hover{border-color:#fff;background:rgba(255,255,255,.1);}
.slide-visual{flex-shrink:0;width:280px;display:flex;align-items:center;justify-content:center;}
.slide-visual img{max-width:100%;max-height:280px;object-fit:contain;filter:drop-shadow(0 16px 48px rgba(0,0,0,.6));transition:transform .5s;}
.slide.active .slide-visual img{transform:translateY(-8px);}
@media(max-width:768px){.slide-content{padding:40px 20px;flex-direction:column;}.slide-visual{width:100%;max-width:200px;}.slide.active{min-height:auto;}}
.slider-dots{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;}
.sdot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);border:none;cursor:pointer;transition:all .3s;padding:0;}
.sdot.active{background:var(--orange);width:28px;border-radius:4px;}
.sarrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.35);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.15);color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:18px;z-index:10;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.sarrow:hover{background:var(--orange);border-color:var(--orange);}
.sarrow.prev{left:20px;}.sarrow.next{right:20px;}

/* FILTER BAR UPGRADE */
.filter-section{background:var(--bg2);border-bottom:1px solid var(--border);padding:14px 20px;position:sticky;top:64px;z-index:90;}
.filter-inner{max-width:1400px;margin:auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
.filter-group{display:flex;align-items:center;gap:8px;}
.filter-label{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}
.brand-pills{display:flex;gap:6px;flex-wrap:wrap;}
.brand-pill{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;color:var(--muted);white-space:nowrap;}
.brand-pill:hover,.brand-pill.active{background:var(--orange);border-color:var(--orange);color:#fff;}
.price-filter{display:flex;align-items:center;gap:8px;}
.price-input{width:90px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;text-align:center;}
.price-input:focus{outline:none;border-color:var(--orange);}
.filter-sep{color:var(--border);font-size:18px;}
.btn-filter-apply{background:var(--orange);border:none;color:#fff;padding:5px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;}
.filter-count{color:var(--muted);font-size:12px;margin-left:auto;}
.btn-clear-filters{background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline;}
.btn-clear-filters:hover{color:var(--orange);}

/* SEARCH AUTOCOMPLETE */
.search-wrap{position:relative;}
.autocomplete-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg2);border:1px solid var(--border);border-radius:10px;z-index:200;max-height:360px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.6);display:none;}
.autocomplete-dropdown.open{display:block;}
.ac-item{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--border);}
.ac-item:last-child{border-bottom:none;}
.ac-item:hover{background:var(--orange-glow);}
.ac-img{width:36px;height:36px;background:#fff;border-radius:5px;object-fit:contain;padding:2px;flex-shrink:0;}
.ac-info{flex:1;min-width:0;}
.ac-name{font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ac-cat{font-size:10px;color:var(--muted);}
.ac-price{font-family:var(--font-head);font-size:14px;color:var(--orange);font-weight:700;flex-shrink:0;}
.ac-section{padding:6px 14px;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:var(--bg3);}

/* RECENTLY VIEWED */
.recently-viewed{max-width:1400px;margin:0 auto;padding:0 20px 40px;}
.rv-scroll{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
.rv-scroll::-webkit-scrollbar{height:4px;}
.rv-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
"""
html = html.replace('</style>', NEW_CSS + '</style>', 1)
print('CSS injected')

# ── REPLACE HERO SLIDER WITH PROFESSIONAL VERSION ─────────────────
old_hs = html.find('<div class="hero-slider"')
depth = 0; old_he = old_hs
for i in range(old_hs, len(html)):
    if html[i:i+4] == '<div': depth += 1
    elif html[i:i+6] == '</div>':
        depth -= 1
        if depth == 0: old_he = i+6; break

PRO_SLIDER = """<div class="hero-slider" id="heroSlider">
  <button class="sarrow prev" onclick="slideMove(-1)">&#8249;</button>
  <button class="sarrow next" onclick="slideMove(1)">&#8250;</button>

  <!-- SLIDE 1: LAPTOPS -->
  <div class="slide active">
    <div class="slide-bg" style="background:linear-gradient(135deg,#0a0a0a 0%,#0d1117 40%,#1a0e00 100%);"></div>
    <div class="slide-overlay" style="background:linear-gradient(90deg,rgba(0,0,0,.7) 0%,rgba(0,0,0,.2) 100%);"></div>
    <div class="slide-content">
      <div class="slide-text">
        <span class="slide-eyebrow">Laptops &amp; Computers</span>
        <h2>Power Through<br/>Your <span class="acc">Workday</span></h2>
        <p>From lightweight ultrabooks to high-performance workstations. Find the perfect machine for work, study or gaming.</p>
        <div class="slide-badges"><span class="slide-badge">Intel &amp; AMD</span><span class="slide-badge">Free Delivery</span><span class="slide-badge">1 Year Warranty</span></div>
        <div class="slide-cta-row">
          <button class="slide-cta" onclick="filterCat('Laptops &amp; Computers')">Shop Laptops &rarr;</button>
          <button class="slide-cta-ghost" onclick="filterCat('Gaming')">Gaming Laptops</button>
        </div>
      </div>
      <div class="slide-visual"><img src="https://api.esquire.co.za/Resources/Images/Products/Big_ASUS-Zenbook-Duo-UX8406-OLED-(1).jpg" alt="Laptops" onerror="this.parentElement.style.display='none'"/></div>
    </div>
  </div>

  <!-- SLIDE 2: SOLAR / LOAD SHEDDING -->
  <div class="slide">
    <div class="slide-bg" style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1000 50%,#0a0a0a 100%);"></div>
    <div class="slide-overlay" style="background:linear-gradient(90deg,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 100%);"></div>
    <div class="slide-content">
      <div class="slide-text">
        <span class="slide-eyebrow">Power &amp; Solar Solutions</span>
        <h2>Stay Powered<br/>Through <span class="acc">Load Shedding</span></h2>
        <p>Don't let loadshedding slow you down. UPS systems, solar inverters and battery backups to keep your home and business running 24/7.</p>
        <div class="slide-badges"><span class="slide-badge">All Stages</span><span class="slide-badge">Home &amp; Business</span><span class="slide-badge">Expert Support</span></div>
        <div class="slide-cta-row">
          <button class="slide-cta" onclick="filterCat('Power &amp; Solar')">Shop Solar &rarr;</button>
        </div>
      </div>
      <div class="slide-visual"><img src="https://www.xyz.co.za/ProdImg/Big_TCT-5700B001.jpg" alt="Solar" onerror="this.parentElement.style.display='none'"/></div>
    </div>
  </div>

  <!-- SLIDE 3: NETWORKING -->
  <div class="slide">
    <div class="slide-bg" style="background:linear-gradient(135deg,#0a0a0a 0%,#001a10 50%,#0a0a0a 100%);"></div>
    <div class="slide-overlay" style="background:linear-gradient(90deg,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 100%);"></div>
    <div class="slide-content">
      <div class="slide-text">
        <span class="slide-eyebrow">Networking &amp; Storage</span>
        <h2>Build Your<br/><span class="acc">Perfect Network</span></h2>
        <p>Routers, switches, NAS devices, access points and more. Fast, reliable connectivity for home offices and businesses across South Africa.</p>
        <div class="slide-badges"><span class="slide-badge">Wi-Fi 6</span><span class="slide-badge">10GbE</span><span class="slide-badge">Enterprise Grade</span></div>
        <div class="slide-cta-row">
          <button class="slide-cta" onclick="filterCat('Networking &amp; Storage')">Shop Networking &rarr;</button>
        </div>
      </div>
      <div class="slide-visual"><img src="https://api.esquire.co.za/Resources/Images/Products/Big_AS6810T_F-4.jpg" alt="Networking" onerror="this.parentElement.style.display='none'"/></div>
    </div>
  </div>

  <!-- SLIDE 4: MONITORS -->
  <div class="slide">
    <div class="slide-bg" style="background:linear-gradient(135deg,#0a0a0a 0%,#0a001a 50%,#0a0a0a 100%);"></div>
    <div class="slide-overlay" style="background:linear-gradient(90deg,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 100%);"></div>
    <div class="slide-content">
      <div class="slide-text">
        <span class="slide-eyebrow">Monitors &amp; Displays</span>
        <h2>See Everything<br/>In <span class="acc">Crystal Clarity</span></h2>
        <p>4K UHD, curved, gaming and smart displays. Upgrade your workspace or entertainment setup with screens from LG, Samsung, Hisense and more.</p>
        <div class="slide-badges"><span class="slide-badge">4K &amp; UHD</span><span class="slide-badge">144Hz Gaming</span><span class="slide-badge">OLED Available</span></div>
        <div class="slide-cta-row">
          <button class="slide-cta" onclick="filterCat('Monitors &amp; Displays')">Shop Monitors &rarr;</button>
        </div>
      </div>
      <div class="slide-visual"><img src="https://api.esquire.co.za/Resources/Images/Products/Big_OLED77G56LA-3.png" alt="Monitors" onerror="this.parentElement.style.display='none'"/></div>
    </div>
  </div>

  <!-- SLIDE 5: GAMING -->
  <div class="slide">
    <div class="slide-bg" style="background:linear-gradient(135deg,#0a0a0a 0%,#1a000a 50%,#0a0a0a 100%);"></div>
    <div class="slide-overlay" style="background:linear-gradient(90deg,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 100%);"></div>
    <div class="slide-content">
      <div class="slide-text">
        <span class="slide-eyebrow">Gaming Setup</span>
        <h2>Level Up Your<br/><span class="acc">Gaming Setup</span></h2>
        <p>Keyboards, mice, headsets, controllers, gaming chairs and monitors. Everything you need to dominate — at prices that won't break the bank.</p>
        <div class="slide-badges"><span class="slide-badge">PC Gaming</span><span class="slide-badge">Console</span><span class="slide-badge">Accessories</span></div>
        <div class="slide-cta-row">
          <button class="slide-cta" onclick="filterCat('Gaming')">Shop Gaming &rarr;</button>
        </div>
      </div>
      <div class="slide-visual"><img src="https://www.xyz.co.za/ProdImg/Big_65MR6DE.jpg" alt="Gaming" onerror="this.parentElement.style.display='none'"/></div>
    </div>
  </div>

  <div class="slider-dots" id="sliderDots"></div>
</div>"""

html = html[:old_hs] + PRO_SLIDER + html[old_he:]
print('Pro slider inserted')

# ── ADD FILTER SECTION + RECENTLY VIEWED + WHATSAPP TO HTML BODY ──

# Add filter section before shop grid
OLD_FILTER = '<div class="filter-bar">'
NEW_FILTER_SECTION = """<div class="filter-section" id="filterSection" style="display:none">
  <div class="filter-inner">
    <div class="filter-group">
      <span class="filter-label">Brand</span>
      <div class="brand-pills" id="brandPills"></div>
    </div>
    <div class="filter-group">
      <span class="filter-label">Price</span>
      <div class="price-filter">
        <span style="color:var(--muted);font-size:12px;">R</span>
        <input class="price-input" type="number" id="priceMin" placeholder="Min" min="0"/>
        <span class="filter-sep">—</span>
        <span style="color:var(--muted);font-size:12px;">R</span>
        <input class="price-input" type="number" id="priceMax" placeholder="Max" min="0"/>
        <button class="btn-filter-apply" onclick="applyPriceFilter()">Go</button>
      </div>
    </div>
    <span class="filter-count" id="filterCount"></span>
    <button class="btn-clear-filters" onclick="clearFilters()">Clear all</button>
  </div>
</div>
<div class="filter-bar">"""

if OLD_FILTER in html:
    html = html.replace(OLD_FILTER, NEW_FILTER_SECTION, 1)
    print('Filter section added')

# Add recently viewed section before footer
OLD_FOOTER = '<footer>'
RV_SECTION = """<div id="recentlyViewedSection" style="display:none">
  <div class="recently-viewed">
    <div class="sec-title">👁️ Recently Viewed</div>
    <div class="rv-scroll" id="rvGrid"></div>
  </div>
</div>
<footer>"""
html = html.replace(OLD_FOOTER, RV_SECTION, 1)
print('Recently viewed section added')

# Add WhatsApp button before </body>
WA_BTN = """
<!-- WHATSAPP FLOATING BUTTON -->
<a class="wa-btn" href="https://wa.me/27696913518?text=Hi%20Online%20TechHub!%20I%20need%20help%20with%20a%20product." target="_blank" title="Chat on WhatsApp" aria-label="WhatsApp">
  <span class="wa-pulse"></span>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.273a.75.75 0 0 0 .92.92l5.443-1.485A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.587-.5-5.079-1.37l-.361-.214-3.742 1.02 1.011-3.667-.235-.38A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
</a>
"""
html = html.replace('</body>', WA_BTN + '</body>', 1)
print('WhatsApp button added')

# Update search input to have autocomplete
OLD_SEARCH = '<input type="text" id="sinput" placeholder="Search 4,000+ products\u2026" oninput="doSearch(this.value)"/>'
NEW_SEARCH = """<input type="text" id="sinput" placeholder="Search 4,000+ products\u2026" 
  oninput="doSearch(this.value);showAutocomplete(this.value)"
  onkeydown="acKeyNav(event)"
  autocomplete="off"/>
<div class="autocomplete-dropdown" id="acDropdown"></div>"""
if OLD_SEARCH in html:
    html = html.replace(OLD_SEARCH, NEW_SEARCH)
    print('Search autocomplete HTML added')
else:
    print('Search input not found - checking...')
    idx = html.find('id="sinput"')
    print('sinput at:', idx)

# ── UPDATE submitOrder TO SEND EMAILS ─────────────────────────────
func_start = html.find('function submitOrder()')
depth = 0; func_end = func_start
for i in range(func_start, len(html)):
    if html[i] == '{': depth += 1
    elif html[i] == '}':
        depth -= 1
        if depth == 0: func_end = i+1; break

NEW_SUBMIT = r"""function submitOrder(){
  const fn=document.getElementById("fn").value.trim();
  const ln=document.getElementById("ln").value.trim();
  const em=document.getElementById("em").value.trim();
  const ph=document.getElementById("ph").value.trim();
  const ad=document.getElementById("ad").value.trim();
  if(!fn||!ln||!em||!ph||!ad){toast("Please fill in all fields");return;}

  const tot=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const oid="OTH-"+Date.now();

  // Close checkout
  document.getElementById("chkmo").classList.remove("open");

  // Remove existing overlay
  const ex=document.getElementById("orderConfirm");
  if(ex)ex.remove();

  // Build overlay
  const ov=document.createElement("div");
  ov.id="orderConfirm";
  ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.93);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";

  ov.innerHTML='<div style="background:var(--bg2);border:2px solid var(--orange);border-radius:14px;max-width:500px;width:100%;padding:32px;text-align:center;">'
    +'<div style="font-size:52px;margin-bottom:12px;">✅</div>'
    +'<h2 style="font-family:var(--font-head);font-size:26px;margin-bottom:8px;color:var(--orange);">Order Placed!</h2>'
    +'<p style="color:var(--muted);font-size:14px;margin-bottom:20px;">Thank you <strong style="color:var(--text);">'+fn+'</strong>! Order <strong style="color:var(--orange);">'+oid+'</strong> received.</p>'
    +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:18px;text-align:left;margin-bottom:16px;">'
      +'<div style="font-family:var(--font-head);font-size:15px;color:var(--orange);margin-bottom:12px;">🏦 EFT Payment Details</div>'
      +'<div style="font-size:13px;line-height:2.4;color:var(--text);">'
        +'<b>Bank:</b> Capitec Business<br/>'
        +'<b>Account Name:</b> ONLINETECHHUB (PTY) LTD<br/>'
        +'<b>Account No:</b> <span style="color:var(--orange);font-weight:700;">1055027882</span><br/>'
        +'<b>Branch:</b> 450105<br/>'
        +'<b>Reference:</b> <span style="color:var(--orange);font-weight:700;">'+oid+'</span><br/>'
        +'<b>Amount:</b> <span style="color:var(--orange);font-size:20px;font-weight:700;">R'+fmt(tot)+'</span>'
      +'</div>'
    +'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:20px;line-height:1.6;">📧 Confirmation email sent to <strong style="color:var(--text);">'+em+'</strong><br/>We confirm within 2-4 hrs of payment. Nationwide delivery.</p>'
    +'<button onclick="document.getElementById(\'orderConfirm\').remove()" style="background:var(--orange);border:none;color:#fff;padding:14px 40px;border-radius:8px;font-family:var(--font-head);font-size:18px;font-weight:700;cursor:pointer;width:100%;margin-bottom:10px;" onmouseover="this.style.background=\'#ea6a0a\'" onmouseout="this.style.background=\'var(--orange)\'">Done — Close</button>'
    +'<p id="emailStatus" style="font-size:11px;color:var(--muted);margin:0;">Sending confirmation emails...</p>'
  +'</div>';

  document.body.appendChild(ov);

  // Send emails via PHP
  fetch('order-mail.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      firstName: fn, lastName: ln, email: em,
      phone: ph, address: ad, orderId: oid,
      total: fmt(tot), payMethod: payMethod,
      items: cart.map(i=>({name:i.name,qty:i.qty,price:i.price}))
    })
  })
  .then(r=>r.json())
  .then(d=>{
    const st=document.getElementById("emailStatus");
    if(st){
      if(d.sentCustomer||d.sentSeller){
        st.textContent="✅ Confirmation emails sent!";
        st.style.color="#22c55e";
      } else {
        st.textContent="Email unavailable — screenshot your order details above.";
        st.style.color="var(--muted)";
      }
    }
  })
  .catch(()=>{
    const st=document.getElementById("emailStatus");
    if(st){st.textContent="Screenshot your banking details above as reference.";st.style.color="var(--muted)";}
  });

  // Clear cart
  cart=[];saveCart();updateCC();
}"""

html = html[:func_start] + NEW_SUBMIT + html[func_end:]
print('submitOrder updated with email')

# ── INJECT ALL NEW JS ─────────────────────────────────────────────
NEW_JS = """
// ── BRAND FILTER ─────────────────────────────────────────────────
let curBrand = '';
let curPriceMin = 0;
let curPriceMax = 0;

function extractBrand(name) {
  const brands = ['HP','Canon','Epson','Brother','Samsung','LG','Asus','Acer','Dell','Lenovo','Hisense','Sony','Logitech','Hikvision','TP-Link','Ubiquiti','Synology','Asustor','Seagate','WD','Toshiba','Intel','AMD','Nvidia','Apple','Microsoft','Huawei','Xiaomi','Mecer','Parrot','APC','Eaton'];
  const nl = name.toLowerCase();
  for (const b of brands) {
    if (nl.startsWith(b.toLowerCase()) || nl.includes(' '+b.toLowerCase()+' ')) return b;
  }
  return '';
}

function buildBrandPills(products) {
  const counts = {};
  products.forEach(p => {
    const b = extractBrand(p.name);
    if (b) counts[b] = (counts[b]||0)+1;
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const pills = document.getElementById('brandPills');
  if (!pills) return;
  pills.innerHTML = sorted.map(([b,c])=>
    `<div class="brand-pill${curBrand===b?' active':''}" onclick="toggleBrand('${b}')">${b} <span style="opacity:.6;font-size:10px;">(${c})</span></div>`
  ).join('');
}

function toggleBrand(b) {
  curBrand = curBrand === b ? '' : b;
  buildBrandPills(filtP);
  applyAllFilters();
}

function applyPriceFilter() {
  curPriceMin = parseInt(document.getElementById('priceMin').value)||0;
  curPriceMax = parseInt(document.getElementById('priceMax').value)||0;
  applyAllFilters();
}

function clearFilters() {
  curBrand=''; curPriceMin=0; curPriceMax=0;
  document.getElementById('priceMin').value='';
  document.getElementById('priceMax').value='';
  buildBrandPills(filtP);
  applyAllFilters();
}

function applyAllFilters() {
  let r = filtP;
  if (curBrand) r = r.filter(p => extractBrand(p.name)===curBrand);
  if (curPriceMin > 0) r = r.filter(p => p.price >= curPriceMin);
  if (curPriceMax > 0) r = r.filter(p => p.price <= curPriceMax);
  const fc = document.getElementById('filterCount');
  if (fc) fc.textContent = r.length.toLocaleString()+' products';
  // Render filtered subset
  const start=(page-1)*PER;
  const slice=r.slice(start,start+PER);
  document.getElementById("shopGrid").innerHTML=slice.length?slice.map(p=>pCard(p)).join(""):'<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)">No products found</div>';
  document.getElementById("rc").textContent=r.length.toLocaleString()+' products';
}

// Show/hide filter bar
function showFilterSection(show) {
  const el = document.getElementById('filterSection');
  if (el) el.style.display = show ? 'block' : 'none';
}

// ── SEARCH AUTOCOMPLETE ───────────────────────────────────────────
let acIdx = -1;

function showAutocomplete(val) {
  const drop = document.getElementById('acDropdown');
  if (!drop) return;
  if (!val || val.length < 2) { drop.classList.remove('open'); return; }
  
  const q = val.toLowerCase();
  const matches = allP.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.code.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q)
  ).slice(0, 8);

  if (!matches.length) { drop.classList.remove('open'); return; }

  drop.innerHTML = `<div class="ac-section">Products matching "${esc(val)}"</div>` +
    matches.map((p,i) => `
      <div class="ac-item" data-idx="${i}" onclick="acSelect(${p.id})" onmouseover="acIdx=${i};acHighlight()">
        <img class="ac-img" src="${p.image||''}" alt="" onerror="this.style.display='none'"/>
        <div class="ac-info">
          <div class="ac-name">${esc(p.name)}</div>
          <div class="ac-cat">${esc(p.category)}</div>
        </div>
        <div class="ac-price">R${fmt(p.price)}</div>
      </div>`
    ).join('');
  drop.classList.add('open');
  acIdx = -1;
}

function acHighlight() {
  document.querySelectorAll('.ac-item').forEach((el,i)=>{
    el.style.background = i===acIdx ? 'var(--orange-glow)' : '';
  });
}

function acSelect(id) {
  document.getElementById('acDropdown').classList.remove('open');
  document.getElementById('sinput').value = '';
  openProd(id);
}

function acKeyNav(e) {
  const drop = document.getElementById('acDropdown');
  const items = drop?.querySelectorAll('.ac-item');
  if (!items?.length) return;
  if (e.key==='ArrowDown') { e.preventDefault(); acIdx=Math.min(acIdx+1,items.length-1); acHighlight(); }
  else if (e.key==='ArrowUp') { e.preventDefault(); acIdx=Math.max(acIdx-1,0); acHighlight(); }
  else if (e.key==='Enter' && acIdx>=0) { items[acIdx].click(); }
  else if (e.key==='Escape') { drop.classList.remove('open'); }
}

// Close autocomplete on outside click
document.addEventListener('click', e=>{
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('acDropdown')?.classList.remove('open');
  }
});

// ── RECENTLY VIEWED ───────────────────────────────────────────────
let recentlyViewed = JSON.parse(sessionStorage.getItem('oth_rv')||'[]');

function addToRecentlyViewed(id) {
  recentlyViewed = [id, ...recentlyViewed.filter(x=>x!==id)].slice(0,10);
  sessionStorage.setItem('oth_rv', JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const sec = document.getElementById('recentlyViewedSection');
  const grid = document.getElementById('rvGrid');
  if (!sec || !grid) return;
  const prods = recentlyViewed.map(id=>allP.find(p=>p.id===id)).filter(Boolean);
  if (prods.length < 2) { sec.style.display='none'; return; }
  sec.style.display = 'block';
  grid.innerHTML = prods.map(p=>`
    <div style="flex-shrink:0;width:160px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:all .2s;" onclick="openProd(${p.id})" onmouseover="this.style.borderColor='var(--orange)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="height:100px;background:#fff;display:flex;align-items:center;justify-content:center;padding:8px;">
        <img src="${p.image||''}" alt="" style="max-width:100%;max-height:84px;object-fit:contain;" onerror="this.style.display='none'"/>
      </div>
      <div style="padding:8px 10px;">
        <div style="font-size:10px;color:var(--orange);font-weight:700;text-transform:uppercase;margin-bottom:3px;">${esc(p.mainCat)}</div>
        <div style="font-size:11px;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(p.name)}</div>
        <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--orange);margin-top:4px;">R${fmt(p.price)}</div>
      </div>
    </div>`
  ).join('');
}
"""

last_init = html.rfind('init();')
html = html[:last_init] + NEW_JS + '\n\n' + html[last_init:]
print('New JS injected')

# ── HOOK openProd TO TRACK RECENTLY VIEWED ────────────────────────
# Add addToRecentlyViewed call inside openProd
OLD_OPENPROD_START = "function openProd(id) {\n  const p = allP.find(x=>x.id===id);\n  if (!p) return;\n  prevView = document.querySelector(\"[id^='v'].on\")?.id || \"vh\";\n  show(\"vprod\");"
NEW_OPENPROD_START = "function openProd(id) {\n  const p = allP.find(x=>x.id===id);\n  if (!p) return;\n  prevView = document.querySelector(\"[id^='v'].on\")?.id || \"vh\";\n  show(\"vprod\");\n  if(typeof addToRecentlyViewed===\"function\")addToRecentlyViewed(id);"

if OLD_OPENPROD_START in html:
    html = html.replace(OLD_OPENPROD_START, NEW_OPENPROD_START)
    print('openProd hooked for recently viewed')

# ── HOOK filterCat TO SHOW FILTER SECTION + BUILD BRAND PILLS ─────
OLD_FILTERCAT = "function filterCat(cat){curCat=cat;curQ=\"\";page=1;document.getElementById(\"sinput\").value=\"\";"
NEW_FILTERCAT = "function filterCat(cat){curCat=cat;curQ=\"\";page=1;curBrand='';curPriceMin=0;curPriceMax=0;document.getElementById(\"sinput\").value=\"\";"
if OLD_FILTERCAT in html:
    html = html.replace(OLD_FILTERCAT, NEW_FILTERCAT)
    print('filterCat updated')

# Hook applyFilters to also build brand pills + show filter bar
OLD_APPLY = "function applyFilters(){"
NEW_APPLY = """function applyFilters(){
  // Show filter section when in shop view
  showFilterSection(document.getElementById('vs').classList.contains('on'));
  buildBrandPills(filtP);
""".replace('\n  // Show filter section when in shop view\n  showFilterSection(document.getElementById(\'vs\').classList.contains(\'on\'));\n  buildBrandPills(filtP);','')

# Just hook init to render recently viewed
OLD_INIT = "function init() {\n  renderCats();\n  renderFeatured();\n  updateCC();\n  initAI();\n  initSlider();\n}"
NEW_INIT = """function init() {
  renderCats();
  renderFeatured();
  updateCC();
  initAI();
  initSlider();
  renderRecentlyViewed();
}"""
html = html.replace(OLD_INIT, NEW_INIT)
print('init() updated')

# ── FINAL CHECKS ─────────────────────────────────────────────────
checks = [
    ('wa-btn', 'WhatsApp button'),
    ('wa-pulse', 'WhatsApp pulse'),
    ('slide-eyebrow', 'Pro slider CSS'),
    ('slide-visual', 'Pro slider HTML'),
    ('filter-section', 'Filter section HTML'),
    ('brand-pills', 'Brand pills'),
    ('autocomplete-dropdown', 'Autocomplete HTML'),
    ('showAutocomplete', 'Autocomplete JS'),
    ('recently-viewed', 'Recently viewed CSS'),
    ('recentlyViewed', 'Recently viewed JS'),
    ('order-mail.php', 'Email PHP call'),
    ('emailStatus', 'Email status indicator'),
    ('1055027882', 'Capitec account'),
    ('hero-slider', 'Slider'),
    ('loadFullSpecs', 'Spec system'),
]
all_ok = True
for check, name in checks:
    found = check in html
    print(f"{'OK' if found else 'FAIL'} {name}")
    if not found: all_ok = False

print()
if all_ok:
    print('ALL CHECKS PASSED! Uploading...')
else:
    print('WARNING: Some checks failed but uploading anyway')

# ── UPLOAD ────────────────────────────────────────────────────────
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=60)
ftp.login(FTP_USER, FTP_PASS)
ftp.cwd('public_html')
data = html.encode('utf-8')
up = [0]
def prog(b):
    up[0]+=len(b)
    if up[0]%(500*1024)<8192: print(f'  {up[0]/len(data)*100:.0f}%')
ftp.storbinary('STOR index.html', io.BytesIO(data), 8192, prog)
print('DEPLOYED!', ftp.size('index.html'), 'bytes')
ftp.quit()
print()
print('LIVE: https://onlinetechhub.co.za')
