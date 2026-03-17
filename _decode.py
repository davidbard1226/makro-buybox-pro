import base64, os
b64 = open('C:/Users/David/makro-buybox-pro/_index_b64.txt').read().strip()
data = base64.b64decode(b64)
with open('C:/Users/David/makro-buybox-pro/index.html', 'wb') as f:
    f.write(data)
print('Written', len(data), 'bytes')
os.remove('C:/Users/David/makro-buybox-pro/_index_b64.txt')
