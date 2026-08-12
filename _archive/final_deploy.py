import ftplib, io, urllib.request, ssl, json, re

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Fetch the current live site
print('Downloading live site...')
html = urllib.request.urlopen(urllib.request.Request('https://cp64-jhb.za-dns.com/~onlinete/',
    headers={'User-Agent':'Mozilla/5.0'}), context=ctx, timeout=30).read().decode('utf-8','ignore')
print(f'Got {len(html)} chars')

def tiered_price(cost):
    if cost <= 1000: return round(cost * 1.20)
    elif cost <= 3000: return round(cost * 1.15)
    elif cost <= 20000: return round(cost * 1.10)
    else: return round(cost * 1.08)

# Apply tiered pricing
pd_start = html.find('const PRODUCT_DATA = [')
pd_end = html.find('];', pd_start) + 2
products = json.loads(html[pd_start+len('const PRODUCT_DATA = '):pd_end-1])
for p in products:
    cost = p.get('cost', 0)
    if cost > 0: p['price'] = tiered_price(cost)
html = html[:pd_start] + 'const PRODUCT_DATA = ' + json.dumps(products, separators=(',',':')) + ';' + html[pd_end:]
print(f'Tiered pricing applied to {len(products)} products')

# Fix Capitec
html = html.replace('YOUR_ACCOUNT_NUMBER', '1055027882')
html = html.replace('470010', '450105')
html = html.replace('Online TechHub (Pty) Ltd', 'ONLINETECHHUB (PTY) LTD')
print('Capitec fixed')
