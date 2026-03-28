import re, ftplib, io, json

with open(r'C:\Users\David\makro-buybox-pro\step1.html', 'r', encoding='utf-8') as f:
    html = f.read()
print('Loaded step1.html:', len(html), 'chars')

# CSS
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
.compat-inline{margin-top:20px;border-top:1px solid var(--border);padding-top:16px}
.compat-inline-title{font-family:var(--font-head);font-size:16px;font-weight:700;margin-bottom:12px}
.compat-inline-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.citab{background:var(--bg3);border:1px solid var(--border);border-radius:16px;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
.citab.active,.citab:hover{background:var(--orange);border-color:var(--orange);color:#fff}
.compat-inline-list{display:flex;flex-direction:column;gap:8px}
.compat-item{display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;transition:border-color .2s}
.compat-item:hover{border-color:var(--orange)}
.compat-item-img{width:48px;height:48px;background:#fff;border-radius:6px;object-fit:contain;padding:3px;flex-shrink:0;cursor:pointer}
.compat-item-info{flex:1;min-width:0;cursor:pointer}
.compat-item-type{font-size:9px;color:var(--orange);font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.compat-item-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.compat-item-price{font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--orange);margin-top:2px}
.compat-item-code{font-size:9px;color:var(--muted)}
.compat-item-add{background:var(--orange);border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;transition:background .2s}
.compat-item-add:hover{background:var(--orange2)}
"""
html = html.replace('</style>', NEW_CSS + '</style>', 1)
print('CSS: OK')

# Slider HTML
h0 = html.find('<div class="hero">')
depth = 0
h1 = h0
for i in range(h0, len(html)):
    if html[i:i+4] == '<div': depth += 1
    elif html[i:i+6] == '</div>':
        depth -= 1
        if depth == 0:
            h1 = i + 6
            break

slides = [
    ("South Africa's Tech Destination", "4,041 products. Laptops, gaming, solar, networking &mdash; shipped nationwide.", "filterCat('all')", "Shop All &rarr;", "https://api.esquire.co.za/Resources/Images/Products/Big_ASUS-Zenbook-Duo-UX8406-OLED-(1).jpg"),
    ("Beat Load Shedding<br/><span class='acc'>Solar &amp; Power</span>", "UPS, solar inverters and backups. Keep running 24/7.", "filterCat('Power & Solar')", "Shop Solar &rarr;", "https://www.xyz.co.za/ProdImg/Big_TCT-5700B001.jpg"),
    ("Level Up Your<br/><span class='acc'>Gaming Setup</span>", "Peripherals, monitors, controllers at unbeatable prices.", "filterCat('Gaming')", "Shop Gaming &rarr;", "https://www.xyz.co.za/ProdImg/Big_65MR6DE.jpg"),
    ("Networking &amp;<br/><span class='acc'>Storage</span>", "Routers, switches, NAS. Build a fast reliable network.", "filterCat('Networking & Storage')", "Shop Networking &rarr;", "https://api.esquire.co.za/Resources/Images/Products/Big_AS6810T_F-4.jpg"),
    ("Monitors &amp;<br/><span class='acc'>Smart Displays</span>", "4K, curved, gaming displays from top brands.", "filterCat('Monitors & Displays')", "Shop Monitors &rarr;", "https://api.esquire.co.za/Resources/Images/Products/Big_OLED77G56LA-3.png"),
]

slider_html = '<div class="hero-slider" id="heroSlider">\n'
slider_html += '<button class="sarrow prev" onclick="window.slideMove(-1)">&#8249;</button>\n'
slider_html += '<button class="sarrow next" onclick="window.slideMove(1)">&#8250;</button>\n'
for idx_s, (title, desc, action, btn, img) in enumerate(slides):
    active = ' active' if idx_s == 0 else ''
    slider_html += (f'<div class="slide{active}"><div class="slide-inner">'
        f'<div class="slide-text"><h2>{title}</h2><p>{desc}</p>'
        f'<button class="slide-cta" onclick="{action}">{btn}</button></div>'
        f'<img class="slide-img" src="{img}" alt="" onerror="this.style.display=\'none\'"/>'
        f'</div></div>\n')
slider_html += '<div class="slider-dots" id="sliderDots"></div>\n</div>'

html = html[:h0] + slider_html + html[h1:]
print('Slider: OK')

# Gallery HTML
OLD_IMG = '<div class="pd-img-box"><img id="pdImg" src="" alt=""/></div>'
NEW_IMG = '<div class="pd-gallery"><div class="pd-main-img"><img id="pdMainImg" src="" alt=""/></div><div class="pd-thumbs" id="pdThumbs"></div></div>'
html = html.replace(OLD_IMG, NEW_IMG)
print('Gallery:', 'pd-thumbs' in html)

# Compat placeholder - find the wishlist button closing in template string
wish_marker = 'btn-wishlist" title="Wishlist">\u2661</button>'
if wish_marker in html:
    wi = html.find(wish_marker) + len(wish_marker)
    # find the template string closing backtick
    close_bt = html.find('`;', wi)
    if 0 < close_bt - wi < 400:
        html = html[:close_bt] + '\n    <div id="compatInline"></div>' + html[close_bt:]
        print('Compat placeholder: below wishlist')
    else:
        html = html.replace('    <!-- Tabs: Description | Specs -->', '    <div id="compatInline"></div>\n    <!-- Tabs: Description | Specs -->', 1)
        print('Compat placeholder: above tabs')

# Update openProd image loading
OLD_PDIMG = '  // Image\n  const img = document.getElementById("pdImg");\n  img.src = p.image || ""; img.alt = p.name;\n  if (!p.image) img.style.display="none"; else img.style.display="block";'
NEW_PDIMG = '  const mimg=document.getElementById("pdMainImg");\n  if(mimg){mimg.src=p.image||"";mimg.alt=p.name;}\n  buildThumbs(p);'
html = html.replace(OLD_PDIMG, NEW_PDIMG)
print('openProd gallery:', 'buildThumbs(p)' in html)

# Add compat render to openProd
OLD_UP = '  // Upsells\n  const upsells = getUpsells(p);'
NEW_UP = '  var ciEl=document.getElementById("compatInline");\n  if(ciEl)ciEl.innerHTML=buildCompatInline(p);\n  // Upsells\n  const upsells = getUpsells(p);'
html = html.replace(OLD_UP, NEW_UP)
print('Compat render:', 'buildCompatInline(p)' in html)

# Fix init() - handle single-line version from live site
OLD_INIT = 'function init() { renderCats(); renderFeatured(); updateCC(); initAI(); }'
NEW_INIT = 'function init() { renderCats(); renderFeatured(); updateCC(); initAI(); initSlider(); }'
html = html.replace(OLD_INIT, NEW_INIT)
print('initSlider in init:', 'initSlider()' in html)

with open(r'C:\Users\David\makro-buybox-pro\step2.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Saved step2.html:', len(html), 'chars')
