import ftplib, io, urllib.request, ssl, json, re

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Load new smart-priced product data
with open(r'C:\Users\David\makro-buybox-pro\products_smart.json') as f:
    pdata = f.read()
print(f'Product data: {len(pdata)/1024/1024:.1f} MB')

# Download live site
print('Downloading live site...')
html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za', headers={'User-Agent':'Mozilla/5.0'}
), context=ctx, timeout=30).read().decode('utf-8','ignore')
print(f'Downloaded: {len(html):,} chars')

# Replace product data
pds = html.find('const PRODUCT_DATA = [')
pde = html.find('];', pds) + 2
html = html[:pds] + 'const PRODUCT_DATA = ' + pdata + ';' + html[pde:]
print('Product data replaced')

# Verify pricing
sample = json.loads(pdata)
cheap = [p for p in sample if p['cost'] <= 50][:3]
mid   = [p for p in sample if 200 <= p['cost'] <= 500][:2]
print('\nVerification - cheap items:')
for p in cheap:
    print(f"  R{p['cost']} cost -> R{p['price']} price")
print('Mid-range items:')
for p in mid:
    print(f"  R{p['cost']} cost -> R{p['price']} price")

print('\nUploading to live server...')
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=60)
ftp.login(FTP_USER, FTP_PASS)
ftp.cwd('public_html')
data = html.encode('utf-8')
up = [0]
def prog(b):
    up[0] += len(b)
    if up[0] % (500*1024) < 8192:
        print(f'  {up[0]/len(data)*100:.0f}%')
ftp.storbinary('STOR index.html', io.BytesIO(data), 8192, prog)
print(f'DONE! {ftp.size("index.html"):,} bytes live')
ftp.quit()
print('\nSmart pricing is now LIVE!')
