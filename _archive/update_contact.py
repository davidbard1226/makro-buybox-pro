import ftplib, io, urllib.request, ssl

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print('Downloading live site...')
html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za', headers={'User-Agent':'Mozilla/5.0'}
), context=ctx, timeout=20).read().decode('utf-8','ignore')
print(f'Downloaded: {len(html):,} chars')

# ── UPDATE CONTACT DETAILS ────────────────────────────────────────
changes = [
    # Footer address
    ('📍 South Africa — Nationwide Delivery',
     '📍 56B High Road, Edenvale, 1610'),
    # Footer contact name + phone
    ('📞 0800 TECHHUB',
     '📞 Sam: 069 691 3518'),
    # About page contact section
    ('📧 info@onlinetechhub.co.za<br/>📞 0800 TECHHUB<br/>📍 South Africa — Nationwide Delivery',
     '📧 info@onlinetechhub.co.za<br/>📞 Sam: 069 691 3518<br/>📍 56B High Road, Edenvale, 1610'),
    # WhatsApp tooltip/title
    ('Chat on WhatsApp',
     'Chat with Sam on WhatsApp'),
    # Footer phone in bottom section
    ('📞 0800 TECHHUB',
     '📞 Sam: 069 691 3518'),
    # Order confirmation email footer
    ('📧 info@onlinetechhub.co.za | 💬 WhatsApp: 069 691 3518',
     '📧 info@onlinetechhub.co.za | 💬 WhatsApp Sam: 069 691 3518'),
    # Hours
    ('Mon–Fri 8am–5pm',
     'Mon–Fri 8am–5pm'),
]

count = 0
for old, new in changes:
    if old in html:
        html = html.replace(old, new)
        print(f'  Updated: {old[:50]}...')
        count += 1
    else:
        print(f'  Skip (not found): {old[:50]}')

# Also update any remaining 0800 TECHHUB references
if '0800 TECHHUB' in html:
    remaining = html.count('0800 TECHHUB')
    html = html.replace('0800 TECHHUB', 'Sam: 069 691 3518')
    print(f'  Updated {remaining} remaining 0800 TECHHUB references')
    count += remaining

# Update address in footer if different format
for old_addr in ['📍 South Africa', 'South Africa — Nationwide']:
    if old_addr in html:
        html = html.replace(old_addr, '📍 56B High Road, Edenvale, 1610')
        print(f'  Updated address: {old_addr}')
        count += 1

print(f'Total changes: {count}')

# Verify
print()
print('Verification:')
print('  Has Sam:', 'Sam' in html)
print('  Has 069 691 3518:', '069 691 3518' in html)
print('  Has Edenvale:', 'Edenvale' in html)
print('  Has 56B High Road:', '56B High Road' in html)
print('  Old 0800 TECHHUB remaining:', html.count('0800 TECHHUB'))

print()
print('Uploading...')
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
