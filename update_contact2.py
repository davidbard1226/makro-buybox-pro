import ftplib, io, urllib.request, ssl, re

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za', headers={'User-Agent':'Mozilla/5.0'}
), context=ctx, timeout=20).read().decode('utf-8','ignore')

# Fix any remaining references using regex for variations
replacements = [
    # About page - phone line
    (r'📞 0800 TECHHUB', '📞 Sam: 069 691 3518'),
    # About page - address line  
    (r'📍 South Africa[^<"]*', '📍 56B High Road, Edenvale, 1610'),
    # Order email footer contact
    (r'info@onlinetechhub\.co\.za \| 💬 WhatsApp: 069 691 3518',
     'info@onlinetechhub.co.za | 💬 WhatsApp Sam: 069 691 3518'),
    # General Mon-Fri line - add address after
    (r'Mon–Fri 8am–5pm<br/>\s*📍[^<"]*',
     'Mon–Fri 8am–5pm<br/>📍 56B High Road, Edenvale, 1610'),
]

count = 0
for pattern, replacement in replacements:
    new_html, n = re.subn(pattern, replacement, html)
    if n > 0:
        html = new_html
        print(f'  Regex replaced {n}x: {pattern[:50]}')
        count += n

# Also fix the about section specifically
about_old = '📧 info@onlinetechhub.co.za<br/>📞 Sam: 069 691 3518<br/>📍 56B High Road, Edenvale, 1610'
about_new = '📧 info@onlinetechhub.co.za<br/>📞 Sam: 069 691 3518<br/>📍 56B High Road, Edenvale, 1610<br/>🕒 Mon–Fri 8am–5pm'

# Find and update the about contact section
about_section_old = '📧 info@onlinetechhub.co.za'
if about_section_old in html:
    # Update the full contact block in about page
    idx = html.find('<div class="about-wrap">')
    if idx > 0:
        about_chunk = html[idx:idx+2000]
        # Replace phone in about section
        new_chunk = about_chunk.replace(
            '📞 Sam: 069 691 3518',
            '📞 Sam: 069 691 3518'
        ).replace(
            'Mon–Fri 8am–5pm',
            'Mon–Fri 8am–5pm'
        )
        html = html[:idx] + new_chunk + html[idx+2000:]

print(f'Total regex changes: {count}')
print()
print('Final verification:')
print('  56B High Road:', html.count('56B High Road'), 'occurrences')
print('  Edenvale:', html.count('Edenvale'), 'occurrences')  
print('  Sam:', html.count('Sam:'), 'occurrences')
print('  069 691 3518:', html.count('069 691 3518'), 'occurrences')
print('  0800 TECHHUB remaining:', html.count('0800 TECHHUB'))

print()
print('Uploading final version...')
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
print(f'DONE! {ftp.size("index.html"):,} bytes')
ftp.quit()
print()
print('Contact details now live:')
print('  Name:    Sam')
print('  Phone:   069 691 3518')
print('  Address: 56B High Road, Edenvale, 1610')
