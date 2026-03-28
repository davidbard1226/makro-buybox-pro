import ftplib, io, urllib.request, ssl, sys

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'

# Fetch v6 from Claude's outputs which are accessible via temp URL
# The file was placed at /mnt/user-data/outputs/ which maps to the chat interface
# We'll fetch it from a Claude-accessible source

# Actually read from local Downloads if available
import os, glob

# Try Downloads first
dl_path = None
for p in glob.glob(r'C:\Users\David\Downloads\OnlineTechHub*.html'):
    if os.path.getsize(p) > 1900000:  # must be ~2MB
        dl_path = p
        break

if dl_path:
    print(f'Reading from Downloads: {dl_path}')
    with open(dl_path, 'r', encoding='utf-8') as f:
        html = f.read()
    has_slider = 'hero-slider' in html
    has_tiered = 'R63719' in html or 'R48599' in html
    has_gallery = 'pd-thumbs' in html
    has_compat = 'buildCompatSection' in html
    print(f'  Slider: {has_slider} | Tiered: {has_tiered} | Gallery: {has_gallery} | Compat: {has_compat}')
    if not (has_slider and has_tiered and has_gallery and has_compat):
        print('File missing features - aborting, use latest download from Claude')
        exit(1)
else:
    print('No suitable file found in Downloads')
    print('Please download the latest OnlineTechHub.html from Claude chat first')
    exit(1)

print(f'File size: {len(html)/1024/1024:.1f} MB')
print('Connecting to FTP...')

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
    if uploaded[0] % (300*1024) < 8192:
        print(f'  {pct:.0f}% ({uploaded[0]/1024:.0f}KB / {file_size/1024:.0f}KB)')

print('Uploading...')
ftp.storbinary('STOR index.html', io.BytesIO(file_bytes), 8192, prog)
print(f'Upload complete! Live size: {ftp.size("index.html")} bytes')
ftp.quit()
print('DONE - v6 is LIVE at https://onlinetechhub.co.za')
