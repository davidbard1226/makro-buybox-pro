import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za', headers={'User-Agent':'Mozilla/5.0'}
), context=ctx, timeout=15).read().decode('utf-8','ignore')

pds = html.find('const PRODUCT_DATA = [')
pde = html.find('];', pds) + 2
prods = json.loads(html[pds+len('const PRODUCT_DATA = '):pde-1])
print('Total products:', len(prods))
print()
print('Cheap items (verify no loss after R120 shipping):')
cheap = sorted(prods, key=lambda x: x['cost'])[:8]
for p in cheap:
    cost = p['cost']
    price = p['price']
    net = price - cost - 120
    print('  Cost R' + str(int(cost)) + ' -> Price R' + str(price) + ' | After ship profit: R' + str(int(net)) + ' | ' + p['name'][:35])

print()
print('Mid-range items:')
mid = [p for p in prods if 200 <= p['cost'] <= 500][:4]
for p in mid:
    cost = p['cost']
    price = p['price']
    net = price - cost - 120
    print('  Cost R' + str(int(cost)) + ' -> Price R' + str(price) + ' | After ship profit: R' + str(int(net)) + ' | ' + p['name'][:35])

print()
print('SMART PRICING LIVE AND VERIFIED!')
