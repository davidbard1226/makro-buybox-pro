import ftplib, io, re

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'

with open(r'C:\Users\David\makro-buybox-pro\live_current.html', encoding='utf-8') as f:
    html = f.read()

print('Loaded:', len(html), 'chars')

# FIX 1: Replace old pdImg image loading with gallery version
# Use regex to handle both CRLF and LF
old_pattern = r'// Image\s+const img = document\.getElementById\("pdImg"\);\s+img\.src = p\.image \|\| ""; img\.alt = p\.name;\s+if \(!p\.image\) img\.style\.display="none"; else img\.style\.display="block";'
new_code = '// Gallery\n  const mimg=document.getElementById("pdMainImg");\n  if(mimg){mimg.src=p.image||"";mimg.alt=p.name;if(!p.image)mimg.style.display="none";else mimg.style.display="block";}\n  if(typeof buildThumbs==="function")buildThumbs(p);'

match = re.search(old_pattern, html)
if match:
    html = html[:match.start()] + new_code + html[match.end():]
    print('FIX 1: Image loading fixed - now uses pdMainImg and buildThumbs')
else:
    print('FIX 1: Pattern not found - checking if already fixed')
    if 'pdMainImg' in html and 'buildThumbs' in html:
        print('  Already fixed!')
    else:
        print('  ERROR: Cannot find image code')

# FIX 2: Add compat render call if missing
if 'buildCompatInline' in html and 'compatInline' in html:
    if 'getElementById("compatInline")' not in html and 'getElementById(' + "'compatInline'" + ')' not in html:
        old_up = re.search(r'\s+// Upsells\s+const upsells = getUpsells\(p\);', html)
        if old_up:
            new_up = '\n  // Compatible products below Add to Cart\n  var ciEl=document.getElementById("compatInline");\n  if(ciEl)ciEl.innerHTML=buildCompatInline(p);\n  // Upsells\n  const upsells = getUpsells(p);'
            html = html[:old_up.start()] + new_up + html[old_up.end():]
            print('FIX 2: Compat render call added to openProd')
        else:
            print('FIX 2: Could not find upsells location')
    else:
        print('FIX 2: Compat render already present')

# Verify
print()
print('=== VERIFICATION ===')
print('pdMainImg in openProd:', 'pdMainImg' in html)
print('pdImg still (bad):', 'getElementById("pdImg")' in html)
print('buildThumbs called:', 'buildThumbs' in html)
print('compat render:', 'compatInline' in html)
print('Gallery HTML:', 'pd-main-img' in html)
print('Slider:', 'hero-slider' in html)
print('Capitec:', '1055027882' in html)

print()
print('Uploading to live server...')
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=60)
ftp.login(FTP_USER, FTP_PASS)
ftp.cwd('public_html')
data = html.encode('utf-8')
uploaded = [0]
def prog(block):
    uploaded[0] += len(block)
    if uploaded[0] % (500*1024) < 8192:
        print(f'  {uploaded[0]/len(data)*100:.0f}%')
ftp.storbinary('STOR index.html', io.BytesIO(data), 8192, prog)
print('DEPLOYED!', ftp.size('index.html'), 'bytes')
ftp.quit()
