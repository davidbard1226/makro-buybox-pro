import ftplib, io, urllib.request, ssl, os

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'

# Download v6 from Claude's live server outputs
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Claude saved the file to the server temp URL indirectly
# Let's build it right here on the PC from the live site + patches

print('Step 1: Downloading live store...')
req = urllib.request.Request('https://cp64-jhb.za-dns.com/~onlinete/', headers={'User-Agent':'Mozilla/5.0'})
resp = urllib.request.urlopen(req, context=ctx, timeout=30)
html = resp.read().decode('utf-8','ignore')
print(f'  Live store: {len(html)} chars')
print(f'  Has slider: {"hero-slider" in html}')
print(f'  Has gallery: {"pd-thumbs" in html}')
print(f'  Has compat: {"buildCompatSection" in html}')

if 'hero-slider' in html and 'pd-thumbs' in html and 'buildCompatSection' in html:
    print('Already v6! Just updating pricing...')

# Apply tiered pricing to the PRODUCT_DATA
import re, json

def tiered_price(cost):
    if cost <= 1000: return round(cost * 1.20)
    elif cost <= 3000: return round(cost * 1.15)
    elif cost <= 20000: return round(cost * 1.10)
    else: return round(cost * 1.08)

# Find and update all "price": values relative to their "cost" values
print('Step 2: Applying tiered pricing...')
pd_start = html.find('const PRODUCT_DATA = [')
pd_end = html.find('];', pd_start) + 2
pd_json = html[pd_start+len('const PRODUCT_DATA = '):pd_end-1]
products = json.loads(pd_json)
print(f'  Products: {len(products)}')

# Apply tiered markup
for p in products:
    cost = p.get('cost', 0)
    if cost > 0:
        p['price'] = tiered_price(cost)

# Verify
sample = [(p['cost'], p['price']) for p in products[:5]]
for c,pr in sample:
    pct = (pr-c)/c*100 if c > 0 else 0
    print(f'  R{c:.0f} -> R{pr} ({pct:.0f}%)')

new_pd = json.dumps(products, separators=(',',':'))
html = html[:pd_start] + 'const PRODUCT_DATA = ' + new_pd + ';' + html[pd_end:]
print(f'  Updated {len(products)} products with tiered pricing')

# Fix Capitec details
html = html.replace('CAPITEC_ACCOUNT_TBD', '1055027882')
html = html.replace('YOUR_ACCOUNT_NUMBER', '1055027882')
html = html.replace('>470010<', '>450105<')
print(f'  Capitec: {"1055027882" in html}')

print('Step 3: Uploading to live server...')
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=60)
ftp.login(FTP_USER, FTP_PASS)
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
print(f'DONE! Live: {live_size} bytes')
print('Visit: https://cp64-jhb.za-dns.com/~onlinete/')
