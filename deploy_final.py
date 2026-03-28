import ftplib, io, urllib.request, ssl, json, os

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Read the v6_final from live server (Claude saved to temp URL)
# Actually read from the local live.html we already have, then apply
# The v6_final is already built - fetch from server is not needed
# Read local copy
local = r'C:\Users\David\makro-buybox-pro\live.html'
if not os.path.exists(local):
    print('ERROR: live.html not found')
    exit(1)

# The built file is on Claude's container - we need to fetch it
# Claude uploaded outputs to server at cp64-jhb.za-dns.com/~onlinete/v6_final.html
# But actually we need to trigger the build here on PC
# Let's just download the already-built version from Claude outputs

print('Fetching v6_final from Claude container...')
# Try fetching from outputs temp URL
try:
    url = 'https://cp64-jhb.za-dns.com/~onlinete/v6_output.html'
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    html = urllib.request.urlopen(req, context=ctx, timeout=15).read().decode('utf-8','ignore')
    print(f'Got from server: {len(html)} chars')
except:
    print('Not on server yet - will build from local')
    html = None

if not html or len(html) < 1000000:
    print('Building from local live.html...')
    with open(local, encoding='utf-8') as f:
        html = f.read()
    print(f'Local: {len(html)} chars')
    print('Slider already:', 'hero-slider' in html)
    if 'hero-slider' not in html:
        print('ERROR: Need to run build first - html is not v6')
        exit(1)

print('Uploading to EliteHost...')
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=60)
ftp.login(FTP_USER, FTP_PASS)
ftp.cwd('public_html')
data = html.encode('utf-8')
uploaded = [0]
def prog(b):
    uploaded[0]+=len(b)
    if uploaded[0]%(400*1024)<8192:
        print(f'  {uploaded[0]/len(data)*100:.0f}%')
ftp.storbinary('STOR index.html', io.BytesIO(data), 8192, prog)
live_size = ftp.size('index.html')
ftp.quit()
print(f'DONE! Live: {live_size:,} bytes')
print('Test: https://cp64-jhb.za-dns.com/~onlinete/')
