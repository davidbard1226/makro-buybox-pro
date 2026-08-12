
import ftplib, io, urllib.request, ssl

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'

# Fetch v6 from temp URL (Claude uploaded it to outputs which is accessible)
TEMP_URL = 'https://cp64-jhb.za-dns.com/~onlinete/index_v6.html'

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print('Fetching v6 from temp server...')
req = urllib.request.Request(TEMP_URL, headers={'User-Agent':'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req, context=ctx, timeout=30)
    html = resp.read().decode('utf-8','ignore')
    print('Got v6 HTML:', len(html), 'chars')
    
    # Verify it has all features
    checks = ['hero-slider','initSlider','pd-thumbs','buildCompatSection','loadFullSpecs','PRODUCT_DATA']
    for c in checks:
        print(c+':', c in html)
    
    # Upload as index.html
    print('Uploading to live server...')
    ftp = ftplib.FTP()
    ftp.connect(FTP_HOST, 21, timeout=60)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.cwd('public_html')
    
    file_size = len(html.encode('utf-8'))
    uploaded = [0]
    def prog(block):
        uploaded[0] += len(block)
        if uploaded[0] % (300*1024) < 8192:
            print(f'  {uploaded[0]/file_size*100:.0f}% uploaded')
    
    ftp.storbinary('STOR index.html', io.BytesIO(html.encode('utf-8')), 8192, prog)
    print('DONE! v6 is LIVE!')
    ftp.quit()
except Exception as e:
    print('Error:', e)
