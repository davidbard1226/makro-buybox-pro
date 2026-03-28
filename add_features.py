import ftplib, io, urllib.request, ssl, json, re

FTP = ('cp64-jhb.za-dns.com', 'onlinete', '8Z7z3s*OB*bjM9')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print('Downloading live store...')
req = urllib.request.Request('https://cp64-jhb.za-dns.com/~onlinete/', headers={'User-Agent':'Mozilla/5.0'})
html = urllib.request.urlopen(req, context=ctx, timeout=30).read().decode('utf-8','ignore')
print(f'Got {len(html)} chars | Slider:{("hero-slider" in html)} Gallery:{("pd-thumbs" in html)} Compat:{("buildCompatSection" in html)}')

# ── CSS ──────────────────────────────────────────────────────────
NEW_CSS = """
.hero-slider{position:relative;overflow:hidden;background:#0a0a0a;min-height:320px}
.slide{position:absolute;inset:0;opacity:0;transition:opacity .7s;display:flex;align-items:center;padding:56px 20px;background:linear-gradient(135deg,#0a0a0a,#1a0e00 50%,#0a0a0a)}
.slide.active{opacity:1;position:relative}
.slide::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(249,115,22,.12),transparent 60%);pointer-events:none}
.slide-inner{max-width:1400px;margin:auto;width:100%;position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:32px}
.slide-text h2{font-family:var(--font-head);font-size:clamp(28px,4vw,52px);font-weight:700;line-height:1.1;margin-bottom:12px}
.slide-text h2 .acc{color:var(--orange)}
.slide-text p{color:var(--muted);font-size:15px;max-width:440px;line-height:1.6;margin-bottom:22px}
.slide-cta{background:var(--orange);color:#fff;border:none;border-radius:8px;padding:12px 28px;font-family:var(--font-head);font-size:16px;font-weight:700;cursor:pointer;transition:background .2s}
.slide-cta:hover{background:var(--orange2)}
.slide-img{width:220px;height:220px;object-fit:contain;opacity:.9;flex-shrink:0;filter:drop-shadow(0 8px 32px rgba(249,115,22,.2))}
@media(max-width:600px){.slide-inner{grid-template-columns:1fr}.slide-img{display:none}}
.slider-dots{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10}
.sdot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);border:none;cursor:pointer;transition:all .2s;padding:0}
.sdot.active{background:var(--orange);width:24px;border-radius:4px}
.sarrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);border:1px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;z-index:10;display:flex;align-items:center;justify-content:center;transition:all .2s}
.sarrow:hover{background:var(--orange);border-color:var(--orange)}.sarrow.prev{left:16px}.sarrow.next{right:16px}
.pd-gallery{display:flex;flex-direction:column;gap:10px;position:sticky;top:84px}
.pd-main-img{background:#fff;border-radius:14px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in}
.pd-main-img img{width:100%;height:100%;object-fit:contain;padding:20px;transition:transform .3s,opacity .2s}
.pd-main-img:hover img{transform:scale(1.07)}
.pd-thumbs{display:flex;gap:8px;flex-wrap:wrap}
.pd-thumb{width:64px;height:64px;background:#fff;border-radius:8px;border:2px solid var(--border);cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .2s}
.pd-thumb:hover,.pd-thumb.active{border-color:var(--orange)}
.pd-thumb img{width:100%;height:100%;object-fit:contain;padding:4px}
.compat-wrap{max-width:1200px;margin:0 auto;padding:0 20px 40px}
.compat-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.ctab{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:6px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
.ctab.active,.ctab:hover{background:var(--orange);border-color:var(--orange);color:#fff}
.compat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px}
.ccard{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:all .2s;display:flex;flex-direction:column}
.ccard:hover{border-color:var(--orange);transform:translateY(-2px)}
.cimg{height:90px;background:#fff;display:flex;align-items:center;justify-content:center;padding:6px}
.cimg img{max-width:100%;max-height:78px;object-fit:contain}
.cbody{padding:8px 10px;flex:1}
.ctype{font-size:9px;color:var(--orange);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.cname{font-size:11px;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cprice{font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--orange);margin-top:3px}
.ccode{font-size:9px;color:var(--muted);margin-top:1px}
.cadd{width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
.cadd:hover{background:var(--orange);border-color:var(--orange);color:#fff}
"""
html = html.replace('</style>', NEW_CSS + '</style>', 1)
print('CSS added')

# ── SLIDER HTML ──────────────────────────────────────────────────
old_hero_start = html.find('<div class="hero">')
depth = 0
old_hero_end = old_hero_start
for i in range(old_hero_start, len(html)):
    if html[i:i+4] == '<div': depth += 1
    elif html[i:i+6] == '</div>':
        depth -= 1
        if depth == 0:
            old_hero_end = i + 6
            break

SLIDER = """<div class="hero-slider" id="heroSlider">
    <button class="sarrow prev" onclick="slideMove(-1)">&#8249;</button>
    <button class="sarrow next" onclick="slideMove(1)">&#8250;</button>
    <div class="slide active"><div class="slide-inner"><div class="slide-text"><h2>South Africa\'s<br/><span class="acc">Tech Destination</span></h2><p>4,041 products at competitive prices. Laptops, gaming, solar, networking — shipped nationwide.</p><button class="slide-cta" onclick="filterCat(\'all\')">Shop All Products &rarr;</button></div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_ASUS-Zenbook-Duo-UX8406-OLED-(1).jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>
    <div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Beat Load Shedding<br/><span class="acc">Solar &amp; Power</span></h2><p>UPS systems, solar inverters and battery backups. Keep your home and office running 24/7.</p><button class="slide-cta" onclick="filterCat(\'Power & Solar\')">Shop Solar &rarr;</button></div><img class="slide-img" src="https://www.xyz.co.za/ProdImg/Big_TCT-5700B001.jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>
    <div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Level Up Your<br/><span class="acc">Gaming Setup</span></h2><p>Peripherals, monitors and controllers. Build your ultimate gaming station at unbeatable prices.</p><button class="slide-cta" onclick="filterCat(\'Gaming\')">Shop Gaming &rarr;</button></div><img class="slide-img" src="https://www.xyz.co.za/ProdImg/Big_65MR6DE.jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>
    <div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Networking &amp;<br/><span class="acc">Storage Solutions</span></h2><p>Routers, switches, NAS devices and more. Build a fast reliable network for home or office.</p><button class="slide-cta" onclick="filterCat(\'Networking & Storage\')">Shop Networking &rarr;</button></div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_AS6810T_F-4.jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>
    <div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Monitors &amp;<br/><span class="acc">Smart Displays</span></h2><p>4K, curved, gaming displays. Upgrade your workspace with crystal-clear screens from top brands.</p><button class="slide-cta" onclick="filterCat(\'Monitors & Displays\')">Shop Monitors &rarr;</button></div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_OLED77G56LA-3.png" alt="" onerror="this.style.display=\'none\'"/></div></div>
    <div class="slider-dots" id="sliderDots"></div>
  </div>"""
html = html[:old_hero_start] + SLIDER + html[old_hero_end:]
print('Slider inserted')

# ── GALLERY HTML ─────────────────────────────────────────────────
OLD_IMG = '<div class="pd-img-box"><img id="pdImg" src="" alt=""/></div>'
NEW_IMG = '<div class="pd-gallery"><div class="pd-main-img"><img id="pdMainImg" src="" alt=""/></div><div class="pd-thumbs" id="pdThumbs"></div></div>'
if OLD_IMG in html:
    html = html.replace(OLD_IMG, NEW_IMG)
    print('Gallery HTML inserted')

# ── COMPAT PLACEHOLDER ────────────────────────────────────────────
if 'compatSection' not in html and '<!-- UPSELL SECTION -->' in html:
    html = html.replace('  <!-- UPSELL SECTION -->', '  <div id="compatSection"></div>\n  <!-- UPSELL SECTION -->', 1)
    print('Compat placeholder added')

# ── UPDATE openProd image loading ────────────────────────────────
OLD_PDIMG = '  // Image\n  const img = document.getElementById("pdImg");\n  img.src = p.image || ""; img.alt = p.name;\n  if (!p.image) img.style.display="none"; else img.style.display="block";'
NEW_PDIMG = '  // Gallery\n  const mimg=document.getElementById("pdMainImg");\n  if(mimg){mimg.src=p.image||"";mimg.alt=p.name;}\n  buildThumbs(p);'
if OLD_PDIMG in html:
    html = html.replace(OLD_PDIMG, NEW_PDIMG)
    print('openProd gallery updated')

# ── ADD COMPAT RENDER TO openProd ─────────────────────────────────
OLD_UP = '  // Upsells\n  const upsells = getUpsells(p);'
NEW_UP = '  const cEl=document.getElementById("compatSection");\n  if(cEl)cEl.innerHTML=buildCompatSection(p);\n  // Upsells\n  const upsells = getUpsells(p);'
if OLD_UP in html:
    html = html.replace(OLD_UP, NEW_UP)
    print('Compat render added')
