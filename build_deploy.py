import urllib.request, ssl, json, re, ftplib, io

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'

print('Step 1: Downloading live site...')
req = urllib.request.Request('https://cp64-jhb.za-dns.com/~onlinete/', headers={'User-Agent':'Mozilla/5.0'})
html = urllib.request.urlopen(req, context=ctx, timeout=30).read().decode('utf-8','ignore')
print(f'  Downloaded {len(html)} chars')

# STEP 2: Apply tiered pricing
print('Step 2: Applying tiered pricing...')
def tiered(cost):
    if cost <= 1000: return round(cost * 1.20)
    elif cost <= 3000: return round(cost * 1.15)
    elif cost <= 20000: return round(cost * 1.10)
    else: return round(cost * 1.08)

pd_start = html.find('const PRODUCT_DATA = [')
pd_end = html.find('];', pd_start) + 2
products = json.loads(html[pd_start + len('const PRODUCT_DATA = '):pd_end - 1])
for p in products:
    c = p.get('cost', 0)
    if c > 0: p['price'] = tiered(c)
new_pd = json.dumps(products, separators=(',', ':'))
html = html[:pd_start] + 'const PRODUCT_DATA = ' + new_pd + ';' + html[pd_end:]
print(f'  {len(products)} products updated')

# STEP 3: Fix Capitec
html = html.replace('YOUR_ACCOUNT_NUMBER', '1055027882')
html = html.replace('CAPITEC_ACCOUNT_TBD', '1055027882')
html = html.replace('>470010<', '>450105<')
html = html.replace('Online TechHub (Pty) Ltd', 'ONLINETECHHUB (PTY) LTD')
print('Step 3: Capitec fixed')

# STEP 4: Add all new CSS
print('Step 4: Adding CSS...')
NEW_CSS = """
/* HERO SLIDER */
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
/* IMAGE GALLERY */
.pd-gallery{display:flex;flex-direction:column;gap:10px;position:sticky;top:84px}
.pd-main-img{background:#fff;border-radius:14px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in}
.pd-main-img img{width:100%;height:100%;object-fit:contain;padding:20px;transition:transform .3s,opacity .2s}
.pd-main-img:hover img{transform:scale(1.07)}
.pd-thumbs{display:flex;gap:8px;flex-wrap:wrap}
.pd-thumb{width:64px;height:64px;background:#fff;border-radius:8px;border:2px solid var(--border);cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .2s}
.pd-thumb:hover,.pd-thumb.active{border-color:var(--orange)}
.pd-thumb img{width:100%;height:100%;object-fit:contain;padding:4px}
/* COMPATIBLE PRODUCTS */
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
.compat-item-name{font-size:12px;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.compat-item-price{font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--orange);margin-top:2px}
.compat-item-code{font-size:9px;color:var(--muted)}
.compat-item-add{background:var(--orange);border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;transition:background .2s}
.compat-item-add:hover{background:var(--orange2)}
"""
html = html.replace('</style>', NEW_CSS + '</style>', 1)
print('  CSS added')

# STEP 5: Replace hero with slider
print('Step 5: Inserting slider...')
old_start = html.find('<div class="hero">')
depth = 0
old_end = old_start
for i in range(old_start, len(html)):
    if html[i:i+4] == '<div': depth += 1
    elif html[i:i+6] == '</div>':
        depth -= 1
        if depth == 0:
            old_end = i + 6
            break

SLIDER = (
    '<div class="hero-slider" id="heroSlider">\n'
    '    <button class="sarrow prev" onclick="window.slideMove(-1)">&#8249;</button>\n'
    '    <button class="sarrow next" onclick="window.slideMove(1)">&#8250;</button>\n'
    '    <div class="slide active"><div class="slide-inner"><div class="slide-text">'
    '<h2>South Africa\'s<br/><span class="acc">Tech Destination</span></h2>'
    '<p>4,041 products at competitive prices. Laptops, gaming, solar, networking &mdash; shipped nationwide.</p>'
    '<button class="slide-cta" onclick="filterCat(\'all\')">Shop All Products &rarr;</button>'
    '</div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_ASUS-Zenbook-Duo-UX8406-OLED-(1).jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>\n'
    '    <div class="slide"><div class="slide-inner"><div class="slide-text">'
    '<h2>Beat Load Shedding<br/><span class="acc">Solar &amp; Power</span></h2>'
    '<p>UPS systems, solar inverters and battery backups. Keep your home and office running 24/7.</p>'
    '<button class="slide-cta" onclick="filterCat(\'Power & Solar\')">Shop Solar &rarr;</button>'
    '</div><img class="slide-img" src="https://www.xyz.co.za/ProdImg/Big_TCT-5700B001.jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>\n'
    '    <div class="slide"><div class="slide-inner"><div class="slide-text">'
    '<h2>Level Up Your<br/><span class="acc">Gaming Setup</span></h2>'
    '<p>Peripherals, monitors and controllers. Build your ultimate station at unbeatable prices.</p>'
    '<button class="slide-cta" onclick="filterCat(\'Gaming\')">Shop Gaming &rarr;</button>'
    '</div><img class="slide-img" src="https://www.xyz.co.za/ProdImg/Big_65MR6DE.jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>\n'
    '    <div class="slide"><div class="slide-inner"><div class="slide-text">'
    '<h2>Networking &amp;<br/><span class="acc">Storage Solutions</span></h2>'
    '<p>Routers, switches, NAS and more. Build a fast reliable network for home or office.</p>'
    '<button class="slide-cta" onclick="filterCat(\'Networking & Storage\')">Shop Networking &rarr;</button>'
    '</div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_AS6810T_F-4.jpg" alt="" onerror="this.style.display=\'none\'"/></div></div>\n'
    '    <div class="slide"><div class="slide-inner"><div class="slide-text">'
    '<h2>Monitors &amp;<br/><span class="acc">Smart Displays</span></h2>'
    '<p>4K, curved, gaming displays. Upgrade your workspace with crystal-clear screens.</p>'
    '<button class="slide-cta" onclick="filterCat(\'Monitors & Displays\')">Shop Monitors &rarr;</button>'
    '</div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_OLED77G56LA-3.png" alt="" onerror="this.style.display=\'none\'"/></div></div>\n'
    '    <div class="slider-dots" id="sliderDots"></div>\n'
    '  </div>'
)
html = html[:old_start] + SLIDER + html[old_end:]
print('  Slider inserted')

# STEP 6: Replace image box with gallery
print('Step 6: Adding image gallery...')
OLD_IMG = '<div class="pd-img-box"><img id="pdImg" src="" alt=""/></div>'
NEW_IMG = '<div class="pd-gallery"><div class="pd-main-img"><img id="pdMainImg" src="" alt=""/></div><div class="pd-thumbs" id="pdThumbs"></div></div>'
if OLD_IMG in html:
    html = html.replace(OLD_IMG, NEW_IMG)
    print('  Gallery inserted')
else:
    print('  WARNING: pd-img-box not found')

# STEP 7: Add compat placeholder below wishlist button (inside pdInfo template string)
print('Step 7: Adding compat placeholder...')
WISHLIST = 'btn-wishlist" title="Wishlist">\u2661</button>'
if WISHLIST in html:
    idx = html.find(WISHLIST) + len(WISHLIST)
    close = html.find('`;', idx)
    if close > idx and close - idx < 300:
        html = html[:close] + '\n    <div id="compatInline"></div>' + html[close:]
        print('  Compat placeholder added below wishlist')
    else:
        # Fallback: add above tabs
        html = html.replace('    <!-- Tabs: Description | Specs -->',
            '    <div id="compatInline"></div>\n    <!-- Tabs: Description | Specs -->', 1)
        print('  Compat placeholder added above tabs (fallback)')

# STEP 8: Update openProd - image loading
OLD_PDIMG = '  // Image\n  const img = document.getElementById("pdImg");\n  img.src = p.image || ""; img.alt = p.name;\n  if (!p.image) img.style.display="none"; else img.style.display="block";'
NEW_PDIMG = '  // Gallery\n  const mimg=document.getElementById("pdMainImg");\n  if(mimg){mimg.src=p.image||"";mimg.alt=p.name;}\n  buildThumbs(p);'
if OLD_PDIMG in html:
    html = html.replace(OLD_PDIMG, NEW_PDIMG)
    print('Step 8: openProd image -> gallery updated')

# Update openProd - add compat render
OLD_UP = '  // Upsells\n  const upsells = getUpsells(p);'
NEW_UP = '  const ciEl=document.getElementById("compatInline");\n  if(ciEl)ciEl.innerHTML=buildCompatInline(p);\n  // Upsells\n  const upsells = getUpsells(p);'
if OLD_UP in html:
    html = html.replace(OLD_UP, NEW_UP)
    print('  compat render added to openProd')

# Update init() to call initSlider
html = html.replace(
    'function init() {\n  renderCats();\n  renderFeatured();\n  updateCC();\n  initAI();\n}',
    'function init() {\n  renderCats();\n  renderFeatured();\n  updateCC();\n  initAI();\n  initSlider();\n}'
)
print('  initSlider added to init()')

# STEP 9: Insert ALL new JS right before the LAST </script> tag
print('Step 9: Inserting new JS...')
NEW_JS = """
// ================================================================
// SLIDER
// ================================================================
var _si=0, _st=null;
function initSlider(){
  var sl=document.querySelectorAll('.slide'),d=document.getElementById('sliderDots');
  if(!sl.length||!d)return;
  var dots='';
  for(var i=0;i<sl.length;i++) dots+='<button class="sdot'+(i===0?' active':'')+'" onclick="goSlide('+i+')"></button>';
  d.innerHTML=dots;
  _startST();
}
function goSlide(n){
  var sl=document.querySelectorAll('.slide'),d=document.querySelectorAll('.sdot');
  if(!sl.length)return;
  sl[_si].classList.remove('active');
  if(d[_si])d[_si].classList.remove('active');
  _si=((n%sl.length)+sl.length)%sl.length;
  sl[_si].classList.add('active');
  if(d[_si])d[_si].classList.add('active');
}
function slideMove(dir){clearTimeout(_st);goSlide(_si+dir);_startST();}
window.slideMove=slideMove;
function _startST(){clearTimeout(_st);_st=setTimeout(function(){goSlide(_si+1);_startST();},5000);}

// ================================================================
// IMAGE GALLERY
// ================================================================
function buildThumbs(p){
  var el=document.getElementById('pdThumbs');
  if(!el)return;
  var imgs=buildImgVars(p);
  if(imgs.length<=1){el.innerHTML='';return;}
  var h='';
  for(var i=0;i<imgs.length;i++){
    h+='<div class="pd-thumb'+(i===0?' active':'')+'" data-src="'+imgs[i]+'" onclick="swImg(this)">';
    h+='<img src="'+imgs[i]+'" loading="lazy" onerror="this.parentElement.style.display=\'none\'"/></div>';
  }
  el.innerHTML=h;
}
function buildImgVars(p){
  if(!p.image)return[];
  var u=p.image,m=u.match(/\\.(jpg|jpeg|png|gif)(\\?.*)?$/i),ext=m?m[1]:'jpg';
  var base=u.replace(/(-\\d+)?\\.(jpg|jpeg|png|gif)(\\?.*)?$/i,''),imgs=[u];
  for(var n=2;n<=5;n++)imgs.push(base+'-'+n+'.'+ext);
  return imgs;
}
function swImg(el){
  var src=el.getAttribute('data-src');
  document.querySelectorAll('.pd-thumb').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  var m=document.getElementById('pdMainImg');
  if(!m)return;
  m.style.opacity='0.4';
  m.src=src;
  m.onload=function(){m.style.opacity='1';};
  m.onerror=function(){m.style.opacity='1';el.style.display='none';};
}

// ================================================================
// COMPATIBLE PRODUCTS (below Add to Cart)
// ================================================================
function getCompat(p){
  var nm=p.name.toLowerCase(),sm=(p.summary||'').toLowerCase(),tx=nm+' '+sm;
  var brm=nm.match(/^(hp|canon|epson|brother|samsung|lexmark|xerox|ricoh|kyocera)/i);
  var br=brm?brm[1].toLowerCase():'';
  var ink=[],ton=[],acc=[];

  if(/inkjet|officejet|deskjet|photosmart|pixma|workforce|expression|stylus|envy|inspire/i.test(tx)){
    var pool=allP.filter(function(q){return ['Ink Cartridges-Original','Ink Cartridges-Generic','Ink and Toners-Generic'].indexOf(q.category)>=0&&q.qty>0&&q.image;});
    if(br)pool=pool.filter(function(q){return q.name.toLowerCase().indexOf(br)>=0;});
    for(var i=0;i<Math.min(6,pool.length);i++)ink.push(pool[i]);
  }
  if(/laserjet|laser|toner|mfp|mfc-l|dcp-l/i.test(tx)){
    var tpool=allP.filter(function(q){return ['Toner Cartridges-Generic','Ink and Toners-Generic','Toner Cartridges-Original'].indexOf(q.category)>=0&&q.qty>0&&q.image;});
    if(br)tpool=tpool.filter(function(q){return q.name.toLowerCase().indexOf(br)>=0;});
    for(var i=0;i<Math.min(6,tpool.length);i++)ton.push(tpool[i]);
  }

  var amap={'Laptops & Computers':['Notebook Bags and Cases','Wireless Mouse','Mouse Pad','Laptop Batteries','Sync & Charge Cables'],
    'Monitors & Displays':['Cable: HDMI','Sync & Charge Cables','Mouse Pad'],
    'Printers & Ink':['Ink Cartridges-Original','Toner Cartridges-Generic','Ink and Toners-Generic'],
    'Mobile & Tablets':['Sync & Charge Cables','Earphones/Earplugs','Apple iPad Covers','iPhone Covers'],
    'Gaming':['Mouse Pad','Wireless Mouse','Earphones/Earplugs','Sync & Charge Cables'],
    'Networking & Storage':['Sync & Charge Cables','Cable: HDMI','Toolkits & Test Equipment'],
    'Power & Solar':['Toolkits & Test Equipment','Sync & Charge Cables'],
    'Audio & Visual':['Sync & Charge Cables','Mouse Pad'],
    'Accessories':['Mouse Pad','Wireless Mouse','Sync & Charge Cables']};
  var cats=amap[p.mainCat]||['Sync & Charge Cables','Mouse Pad','Wireless Mouse'];
  for(var ci=0;ci<cats.length;ci++){
    var found=allP.filter(function(q){return q.category===cats[ci]&&q.qty>0&&q.id!==p.id&&q.image;});
    if(found.length)acc.push(found[Math.floor(Math.random()*found.length)]);
    if(acc.length>=4)break;
  }
  return{ink:ink,ton:ton,acc:acc};
}

function buildCompatInline(p){
  var c=getCompat(p);
  var tabs=[];
  if(c.ink.length)tabs.push({id:'ci_ink',lbl:'Ink ('+c.ink.length+')',emoji:'\\u{1F5A8}\\uFE0F',items:c.ink,type:'Ink Cartridge'});
  if(c.ton.length)tabs.push({id:'ci_ton',lbl:'Toner ('+c.ton.length+')',emoji:'\\u25FC\\uFE0F',items:c.ton,type:'Toner'});
  if(c.acc.length)tabs.push({id:'ci_acc',lbl:'Accessories ('+c.acc.length+')',emoji:'\\uD83D\\uDCE6',items:c.acc,type:'Accessory'});
  if(!tabs.length)return'';

  var tabsH='';
  for(var i=0;i<tabs.length;i++){
    tabsH+='<div class="citab'+(i===0?' active':'')+'" onclick="swCiTab(this,\\''+tabs[i].id+'\\')">'+tabs[i].emoji+' '+tabs[i].lbl+'</div>';
  }

  var listsH='';
  for(var i=0;i<tabs.length;i++){
    listsH+='<div class="compat-inline-list" id="'+tabs[i].id+'" style="'+(i>0?'display:none':'')+'flex-direction:column">';
    for(var j=0;j<tabs[i].items.length;j++){
      var q=tabs[i].items[j];
      listsH+='<div class="compat-item">';
      listsH+='<img class="compat-item-img" src="'+q.image+'" loading="lazy" onclick="openProd('+q.id+')" onerror="this.style.display=\\'none\\'" />';
      listsH+='<div class="compat-item-info" onclick="openProd('+q.id+')">';
      listsH+='<div class="compat-item-type">'+tabs[i].type+'</div>';
      listsH+='<div class="compat-item-name">'+esc(q.name)+'</div>';
      listsH+='<div class="compat-item-price">R'+fmt(q.price)+'</div>';
      listsH+='<div class="compat-item-code">'+esc(q.code)+'</div>';
      listsH+='</div>';
      listsH+='<button class="compat-item-add" onclick="addCart('+q.id+')">+ Add to Cart</button>';
      listsH+='</div>';
    }
    listsH+='</div>';
  }

  return '<div class="compat-inline"><div class="compat-inline-title">\\uD83D\\uDD17 Compatible Products</div>'
    +'<div class="compat-inline-tabs">'+tabsH+'</div>'+listsH+'</div>';
}

function swCiTab(el,pid){
  var wrap=el.closest('.compat-inline');
  wrap.querySelectorAll('.citab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  wrap.querySelectorAll('.compat-inline-list').forEach(function(g){g.style.display='none';});
  var panel=document.getElementById(pid);
  if(panel){panel.style.display='flex';panel.style.flexDirection='column';}
}
"""
# Insert before the LAST </script> tag
last_script_close = html.rfind('</script>')
html = html[:last_script_close] + NEW_JS + '\n' + html[last_script_close:]
print('  JS inserted before last </script>')

# STEP 10: Verify and deploy
print('Step 10: Verifying...')
checks = [
    ('Tiered pricing', '47519'),
    ('Capitec', '1055027882'),
    ('Slider CSS', 'hero-slider'),
    ('Slider HTML', 'sliderDots'),
    ('slideMove func', 'function slideMove'),
    ('window.slideMove', 'window.slideMove=slideMove'),
    ('initSlider', 'function initSlider'),
    ('initSlider in init', 'initSlider();'),
    ('Gallery HTML', 'pd-thumbs'),
    ('buildThumbs', 'function buildThumbs'),
    ('buildImgVars', 'function buildImgVars'),
    ('swImg', 'function swImg'),
    ('Compat CSS', 'compat-inline-title'),
    ('Compat HTML', 'compatInline'),
    ('buildCompatInline', 'function buildCompatInline'),
    ('getCompat', 'function getCompat'),
    ('swCiTab', 'function swCiTab'),
    ('Spec system', 'loadFullSpecs'),
    ('AI Chat', 'sendAI'),
]
all_ok = True
for name, check in checks:
    found = check in html
    status = 'OK' if found else 'FAIL'
    print(f'  {status} - {name}')
    if not found: all_ok = False

if not all_ok:
    print('STOPPING - some checks failed')
    exit(1)

print(f'\nAll checks passed! File size: {len(html)/1024/1024:.1f} MB')
print('Uploading to live server...')

import ftplib, io
ftp = ftplib.FTP()
ftp.connect('cp64-jhb.za-dns.com', 21, timeout=60)
ftp.login('onlinete', '8Z7z3s*OB*bjM9')
ftp.cwd('public_html')

file_bytes = html.encode('utf-8')
file_size = len(file_bytes)
uploaded = [0]
def prog(block):
    uploaded[0] += len(block)
    pct = uploaded[0]/file_size*100
    if uploaded[0] % (400*1024) < 8192:
        print(f'  Uploading... {pct:.0f}%')

ftp.storbinary('STOR index.html', io.BytesIO(file_bytes), 8192, prog)
live_size = ftp.size('index.html')
ftp.quit()
print(f'\nDEPLOYED! Live file: {live_size:,} bytes')
print('Visit: https://cp64-jhb.za-dns.com/~onlinete/')
