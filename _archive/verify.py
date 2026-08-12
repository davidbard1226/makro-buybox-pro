import urllib.request, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
html = urllib.request.urlopen(urllib.request.Request('https://onlinetechhub.co.za',
    headers={'User-Agent':'Mozilla/5.0'}), context=ctx, timeout=15).read().decode('utf-8','ignore')

print('Live site verification')
print('Size:', len(html))
print()

bad_old = 'getElementById("pdImg")' in html
print('BAD old pdImg in JS:', bad_old, '(should be False)')
print()

good = [
    ('pdMainImg', 'Gallery uses pdMainImg'),
    ('buildThumbs', 'buildThumbs function'),
    ('pd-gallery', 'Gallery CSS'),
    ('hero-slider', 'Hero Slider'),
    ('function slideMove', 'slideMove in head'),
    ('buildCompatInline', 'Compatible products'),
    ('compatInline', 'Compat placeholder'),
    ('loadFullSpecs', 'Spec system'),
    ('sendAI', 'TechBot AI'),
    ('1055027882', 'Capitec account'),
    ('450105', 'Branch code'),
    ('47519', 'Tiered pricing'),
]
all_ok = not bad_old
for check, name in good:
    found = check in html
    status = 'OK' if found else 'FAIL'
    print(status, name)
    if not found: all_ok = False

print()
print('LIVE AND WORKING!' if all_ok else 'Some issues remain')
