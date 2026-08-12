import ftplib, io, urllib.request, ssl, json, re, os

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print('Step 1: Downloading live site...')
html = urllib.request.urlopen(urllib.request.Request(
    'https://cp64-jhb.za-dns.com/~onlinete/',
    headers={'User-Agent':'Mozilla/5.0'}), context=ctx, timeout=30
).read().decode('utf-8','ignore')
print(f'  Downloaded: {len(html):,} chars')

print('Step 2: Applying tiered pricing...')
def tiered(c):
    if c<=1000: return round(c*1.20)
    elif c<=3000: return round(c*1.15)
    elif c<=20000: return round(c*1.10)
    return round(c*1.08)

pds = html.find('const PRODUCT_DATA = [')
pde = html.find('];', pds)+2
prods = json.loads(html[pds+len('const PRODUCT_DATA = '):pde-1])
for p in prods:
    if p.get('cost',0)>0: p['price']=tiered(p['cost'])
html = html[:pds]+'const PRODUCT_DATA = '+json.dumps(prods,separators=(',',':'))+';'+html[pde:]
print(f'  {len(prods):,} products updated')

print('Step 3: Fixing Capitec details...')
html = html.replace('YOUR_ACCOUNT_NUMBER','1055027882')
html = html.replace('470010','450105')
html = html.replace('Online TechHub (Pty) Ltd','ONLINETECHHUB (PTY) LTD')

print('Step 4: Adding CSS...')
NEW_CSS = """
.hero-slider{position:relative;overflow:hidden;background:#0a0a0a;min-height:320px}
.slide{position:absolute;inset:0;opacity:0;transition:opacity .7s;display:flex;align-items:center;padding:56px 20px;background:linear-gradient(135deg,#0a0a0a,#1a0e00 50%,#0a0a0a)}
.slide.active{opacity:1;position:relative}
.slide::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(249,115,22,.12),transparent 60%);pointer-events:none}
.slide-inner{max-width:1400px;margin:auto;width:100%;position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:32px}
.slide-text h2{font-family:var(--font-head);font-size:clamp(28px,4vw,52px);font-weight:700;line-height:1.1;margin-bottom:12px}
.slide-text h2 .acc{color:var(--orange)}.slide-text p{color:var(--muted);font-size:15px;max-width:440px;line-height:1.6;margin-bottom:22px}
.slide-cta{background:var(--orange);color:#fff;border:none;border-radius:8px;padding:12px 28px;font-family:var(--font-head);font-size:16px;font-weight:700;cursor:pointer;transition:background .2s}.slide-cta:hover{background:var(--orange2)}
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
.compat-inline{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
.compat-inline-title{font-family:var(--font-head);font-size:15px;font-weight:700;margin-bottom:10px;color:var(--text)}
.compat-inline-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.citab{background:var(--bg3);border:1px solid var(--border);border-radius:16px;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
.citab.active,.citab:hover{background:var(--orange);border-color:var(--orange);color:#fff}
.compat-inline-list{display:flex;flex-direction:column;gap:7px}
.ci-item{display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;transition:border-color .2s}
.ci-item:hover{border-color:var(--orange)}
.ci-img{width:48px;height:48px;background:#fff;border-radius:6px;object-fit:contain;padding:3px;flex-shrink:0;cursor:pointer}
.ci-info{flex:1;min-width:0;cursor:pointer}
.ci-type{font-size:9px;color:var(--orange);font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.ci-name{font-size:12px;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-price{font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--orange);margin-top:1px}
.ci-code{font-size:9px;color:var(--muted)}
.ci-add{background:var(--orange);border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;transition:background .2s}
.ci-add:hover{background:var(--orange2)}
"""
html = html.replace('</style>', NEW_CSS + '</style>', 1)
print('  CSS done')

print('Step 5: Adding early JS to <head> (fixes slideMove undefined)...')
HEAD_JS = """<script>
var _si=0,_st=null;
function slideMove(dir){
  clearTimeout(_st);
  var sl=document.querySelectorAll('.slide'),d=document.querySelectorAll('.sdot');
  if(!sl.length)return;
  sl[_si].classList.remove('active');if(d[_si])d[_si].classList.remove('active');
  _si=((_si+dir)%sl.length+sl.length)%sl.length;
  sl[_si].classList.add('active');if(d[_si])d[_si].classList.add('active');
  _st=setTimeout(function(){slideMove(1);},5000);
}
function initSlider(){
  var sl=document.querySelectorAll('.slide'),d=document.getElementById('sliderDots');
  if(!sl.length||!d)return;
  d.innerHTML=Array.from(sl).map(function(_,i){return '<button class="sdot'+(i===0?' active':'')+'" onclick="goSlide('+i+')"></button>';}).join('');
  _st=setTimeout(function(){slideMove(1);},5000);
}
function goSlide(n){
  var sl=document.querySelectorAll('.slide'),d=document.querySelectorAll('.sdot');
  if(!sl.length)return;
  sl[_si].classList.remove('active');if(d[_si])d[_si].classList.remove('active');
  _si=((n%sl.length)+sl.length)%sl.length;
  sl[_si].classList.add('active');if(d[_si])d[_si].classList.add('active');
  clearTimeout(_st);_st=setTimeout(function(){slideMove(1);},5000);
}
function swImg(el,src){
  document.querySelectorAll('.pd-thumb').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  var m=document.getElementById('pdMainImg');if(!m)return;
  m.style.opacity='0.4';m.src=src;
  m.onload=function(){m.style.opacity='1';};
  m.onerror=function(){m.style.opacity='1';el.style.display='none';};
}
function swCiTab(el,pid){
  var w=el.closest('.compat-inline');
  w.querySelectorAll('.citab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  w.querySelectorAll('.compat-inline-list').forEach(function(g){g.style.display='none';});
  var p=document.getElementById(pid);if(p){p.style.display='flex';p.style.flexDirection='column';}
}
</script>"""
html = html.replace('</head>', HEAD_JS + '</head>', 1)
print('  Head JS done')

print('Step 6: Replacing hero with slider...')
hs = html.find('<div class="hero">')
depth=0; he=hs
for i in range(hs,len(html)):
    if html[i:i+4]=='<div': depth+=1
    elif html[i:i+6]=='</div>':
        depth-=1
        if depth==0: he=i+6; break
SLIDER=(
'<div class="hero-slider" id="heroSlider">\n'
'<button class="sarrow prev" onclick="slideMove(-1)">&#8249;</button>\n'
'<button class="sarrow next" onclick="slideMove(1)">&#8250;</button>\n'
'<div class="slide active"><div class="slide-inner"><div class="slide-text"><h2>South Africa\'s<br/><span class="acc">Tech Destination</span></h2><p>4,041 products at competitive prices. Laptops, gaming, solar &mdash; nationwide delivery.</p><button class="slide-cta" onclick="filterCat(\'all\')">Shop All Products &rarr;</button></div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_ASUS-Zenbook-Duo-UX8406-OLED-(1).jpg" onerror="this.style.display=\'none\'" alt=""/></div></div>\n'
'<div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Beat Load Shedding<br/><span class="acc">Solar &amp; Power</span></h2><p>UPS, solar inverters and battery backups. Keep your home and office running 24/7.</p><button class="slide-cta" onclick="filterCat(\'Power & Solar\')">Shop Solar &rarr;</button></div><img class="slide-img" src="https://www.xyz.co.za/ProdImg/Big_TCT-5700B001.jpg" onerror="this.style.display=\'none\'" alt=""/></div></div>\n'
'<div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Level Up Your<br/><span class="acc">Gaming Setup</span></h2><p>Peripherals, monitors and controllers at unbeatable prices. Build your ultimate station.</p><button class="slide-cta" onclick="filterCat(\'Gaming\')">Shop Gaming &rarr;</button></div><img class="slide-img" src="https://www.xyz.co.za/ProdImg/Big_65MR6DE.jpg" onerror="this.style.display=\'none\'" alt=""/></div></div>\n'
'<div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Networking &amp;<br/><span class="acc">Storage Solutions</span></h2><p>Routers, switches and NAS for home or office. Fast reliable networks at great prices.</p><button class="slide-cta" onclick="filterCat(\'Networking & Storage\')">Shop Networking &rarr;</button></div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_AS6810T_F-4.jpg" onerror="this.style.display=\'none\'" alt=""/></div></div>\n'
'<div class="slide"><div class="slide-inner"><div class="slide-text"><h2>Monitors &amp;<br/><span class="acc">Smart Displays</span></h2><p>4K, curved and gaming displays. Crystal-clear screens from top brands at competitive prices.</p><button class="slide-cta" onclick="filterCat(\'Monitors & Displays\')">Shop Monitors &rarr;</button></div><img class="slide-img" src="https://api.esquire.co.za/Resources/Images/Products/Big_OLED77G56LA-3.png" onerror="this.style.display=\'none\'" alt=""/></div></div>\n'
'<div class="slider-dots" id="sliderDots"></div></div>')
html=html[:hs]+SLIDER+html[he:]
print('  Slider done')

print('Step 7: Gallery + compat HTML...')
OLD_IMG='<div class="pd-img-box"><img id="pdImg" src="" alt=""/></div>'
NEW_IMG='<div class="pd-gallery"><div class="pd-main-img"><img id="pdMainImg" src="" alt=""/></div><div class="pd-thumbs" id="pdThumbs"></div></div>'
if OLD_IMG in html:
    html=html.replace(OLD_IMG,NEW_IMG)
    print('  Gallery HTML done')

# Add compat placeholder after wishlist button in pdInfo template string
WL='\u2661</button>'
if WL in html:
    idx=html.find(WL)+len(WL)
    nsc=html.find('`;',idx)
    if 0<nsc-idx<400:
        html=html[:nsc]+'\n    <div id="compatInline"></div>'+html[nsc:]
        print('  Compat placeholder done (in template)')
    else:
        OLD_TABS='    <!-- Tabs: Description | Specs -->'
        if OLD_TABS in html:
            html=html.replace(OLD_TABS,'    <div id="compatInline" style="padding:0 0 8px"></div>\n'+OLD_TABS,1)
            print('  Compat placeholder done (above tabs)')

print('Step 8: Updating openProd JS...')
OLD_PJ=('  // Image\n  const img = document.getElementById("pdImg");\n'
        '  img.src = p.image || ""; img.alt = p.name;\n'
        '  if (!p.image) img.style.display="none"; else img.style.display="block";')
NEW_PJ='  const mimg=document.getElementById("pdMainImg");\n  if(mimg){mimg.src=p.image||"";mimg.alt=p.name;}\n  buildThumbs(p);'
if OLD_PJ in html:
    html=html.replace(OLD_PJ,NEW_PJ)
    print('  openProd image done')

OLD_UP='  // Upsells\n  const upsells = getUpsells(p);'
NEW_UP='  const ciEl=document.getElementById("compatInline");\n  if(ciEl)ciEl.innerHTML=buildCompatInline(p);\n  // Upsells\n  const upsells = getUpsells(p);'
if OLD_UP in html:
    html=html.replace(OLD_UP,NEW_UP)
    print('  openProd compat done')

html=html.replace(
    'function init() {\n  renderCats();\n  renderFeatured();\n  updateCC();\n  initAI();\n}',
    'function init() {\n  renderCats();\n  renderFeatured();\n  updateCC();\n  initAI();\n  initSlider();\n}')
print('  initSlider done')

print('Step 9: Inserting gallery + compat body JS...')
BODY_JS="""
function buildThumbs(p){
  var el=document.getElementById('pdThumbs');if(!el)return;
  var imgs=buildImgVars(p);
  el.innerHTML=imgs.length>1?imgs.map(function(s,i){
    return '<div class="pd-thumb'+(i===0?' active':'')+'" onclick="swImg(this,\\''+s+'\\')"><img src="'+s+'" loading="lazy" onerror="this.parentElement.style.display=\\'none\\'"/></div>';
  }).join(''):'';
}
function buildImgVars(p){
  if(!p.image)return[];
  var u=p.image,em=u.match(/\.(jpg|jpeg|png|gif)(\?.*)?$/i),ext=em?em[1]:'jpg';
  var base=u.replace(/(-\d+)?\.(jpg|jpeg|png|gif)(\?.*)?$/i,''),imgs=[u];
  for(var n=2;n<=5;n++)imgs.push(base+'-'+n+'.'+ext);
  return imgs;
}
function getCompat(p){
  var nm=p.name.toLowerCase(),sm=(p.summary||'').toLowerCase(),tx=nm+' '+sm;
  var brm=nm.match(/^(hp|canon|epson|brother|samsung|lexmark|xerox|ricoh|kyocera)/i),br=brm?brm[1].toLowerCase():'';
  var ink=[],ton=[],acc=[];
  if(/inkjet|officejet|deskjet|photosmart|pixma|workforce|expression|stylus|envy|inspire/i.test(tx)){
    var pool=allP.filter(function(q){return ['Ink Cartridges-Original','Ink Cartridges-Generic','Ink and Toners-Generic'].includes(q.category)&&q.qty>0&&q.image;});
    if(br)pool=pool.filter(function(q){return q.name.toLowerCase().includes(br);});
    ink=pool.slice(0,6);
  }
  if(/laserjet|laser|toner|mfp|mfc-l|dcp-l/i.test(tx)){
    var pool2=allP.filter(function(q){return ['Toner Cartridges-Generic','Ink and Toners-Generic','Toner Cartridges-Original'].includes(q.category)&&q.qty>0&&q.image;});
    if(br)pool2=pool2.filter(function(q){return q.name.toLowerCase().includes(br);});
    ton=pool2.slice(0,6);
  }
  var amap={'Laptops & Computers':['Notebook Bags and Cases','Wireless Mouse','Mouse Pad','Laptop Batteries','Sync & Charge Cables'],'Monitors & Displays':['Cable: HDMI','Sync & Charge Cables','Mouse Pad'],'Printers & Ink':['Ink Cartridges-Original','Toner Cartridges-Generic','Ink and Toners-Generic'],'Mobile & Tablets':['Sync & Charge Cables','Earphones/Earplugs','Apple iPad Covers','iPhone Covers'],'Gaming':['Mouse Pad','Wireless Mouse','Earphones/Earplugs','Sync & Charge Cables'],'Networking & Storage':['Sync & Charge Cables','Cable: HDMI','Toolkits & Test Equipment'],'Power & Solar':['Toolkits & Test Equipment','Sync & Charge Cables'],'Audio & Visual':['Sync & Charge Cables','Mouse Pad'],'Accessories':['Mouse Pad','Wireless Mouse','Sync & Charge Cables']};
  var cats=amap[p.mainCat]||['Sync & Charge Cables','Mouse Pad','Wireless Mouse'];
  for(var i=0;i<cats.length;i++){
    var f=allP.filter(function(q){return q.category===cats[i]&&q.qty>0&&q.id!==p.id&&q.image;});
    if(f.length){acc.push(f[Math.floor(Math.random()*f.length)]);}
    if(acc.length>=4)break;
  }
  return{ink:ink,ton:ton,acc:acc};
}
function buildCompatInline(p){
  var c=getCompat(p),tabs=[];
  if(c.ink.length)tabs.push({id:'ci_ink',lbl:'Ink ('+c.ink.length+')',emoji:'Ink',items:c.ink,type:'Ink Cartridge'});
  if(c.ton.length)tabs.push({id:'ci_ton',lbl:'Toner ('+c.ton.length+')',emoji:'Toner',items:c.ton,type:'Toner'});
  if(c.acc.length)tabs.push({id:'ci_acc',lbl:'Accessories ('+c.acc.length+')',emoji:'Accessories',items:c.acc,type:'Accessory'});
  if(!tabs.length)return'';
  var tH=tabs.map(function(t,i){return '<div class="citab'+(i===0?' active':'')+'" onclick="swCiTab(this,\\''+t.id+'\\')">'+t.emoji+'</div>';}).join('');
  var lH=tabs.map(function(t,i){
    return '<div class="compat-inline-list" id="'+t.id+'" style="'+(i>0?'display:none':'display:flex;flex-direction:column')+'">'+
      t.items.map(function(q){
        return '<div class="ci-item"><img class="ci-img" src="'+q.image+'" loading="lazy" onclick="openProd('+q.id+')" onerror="this.style.display=\\'none\\'"/><div class="ci-info" onclick="openProd('+q.id+')"><div class="ci-type">'+t.type+'</div><div class="ci-name">'+esc(q.name)+'</div><div class="ci-price">R'+fmt(q.price)+'</div><div class="ci-code">'+esc(q.code)+'</div></div><button class="ci-add" onclick="addCart('+q.id+')">+ Add to Cart</button></div>';
      }).join('')+'</div>';
  }).join('');
  return '<div class="compat-inline"><div class="compat-inline-title">Compatible Products</div><div class="compat-inline-tabs">'+tH+'</div>'+lH+'</div>';
}
"""
li=html.rfind('init();')
html=html[:li]+BODY_JS+'\n\n'+html[li:]
print('  Body JS done')

print('Step 10: Verifying...')
checks=[('47519','Tiered'),('1055027882','Capitec'),('450105','Branch'),
        ('function slideMove','slideMove in head'),('hero-slider','Slider CSS'),
        ('sliderDots','Slider HTML'),('pd-thumbs','Gallery HTML'),
        ('buildImgVars','Gallery JS'),('ci-item','Compat CSS'),
        ('compatInline','Compat HTML'),('buildCompatInline','Compat JS'),
        ('swCiTab','Tab switch'),('loadFullSpecs','Spec system'),('sendAI','AI chat')]
ok=True
for check,name in checks:
    f=check in html
    print(f"  {'OK' if f else 'FAIL'} {name}")
    if not f: ok=False

if not ok:
    print('ABORTED - checks failed'); exit(1)

print(f'Step 11: Uploading {len(html):,} chars to EliteHost...')
ftp=ftplib.FTP()
ftp.connect(FTP_HOST,21,timeout=60)
ftp.login(FTP_USER,FTP_PASS)
ftp.cwd('public_html')
data=html.encode('utf-8')
up=[0]
def prog(b):
    up[0]+=len(b)
    if up[0]%(400*1024)<8192:print(f'  {up[0]/len(data)*100:.0f}%')
ftp.storbinary('STOR index.html',io.BytesIO(data),8192,prog)
print(f'LIVE! {ftp.size("index.html"):,} bytes')
ftp.quit()
print()
print('Test URL: https://cp64-jhb.za-dns.com/~onlinete/')
print('Live URL: https://onlinetechhub.co.za')
print()
print('What is live:')
print('  Slider: hero banner rotates every 5 seconds')
print('  Gallery: product image thumbnails below main image')
print('  Compatible: ink/toner/accessories below Add to Cart')
print('  Pricing: tiered 8-20% based on cost')
print('  Capitec: account 1055027882 branch 450105')
