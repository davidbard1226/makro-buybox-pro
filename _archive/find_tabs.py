with open(r'C:\Users\David\makro-buybox-pro\index.html', encoding='utf-8') as f:
    html = f.read()
import re
# Find switchTab calls
idx = html.find('switchTab')
print(html[idx-300:idx+500])
