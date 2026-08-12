import urllib.request, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za',
    headers={'User-Agent':'Mozilla/5.0'}), context=ctx, timeout=15
).read().decode('utf-8','ignore')

# Find submitOrder function
idx = html.find('function submitOrder')
print('submitOrder:')
print(html[idx:idx+1500])
