with open(r'C:\Users\David\makro-buybox-pro\index.html', encoding='utf-8') as f:
    html = f.read()
# Find tab-content divs
import re
# Search for tab-content class divs
matches = [(m.start(), html[m.start():m.start()+120]) for m in re.finditer(r'class=["\'][^"\']*tab-content[^"\']*["\']', html)]
print('tab-content divs:', len(matches))
for pos, snip in matches[:5]:
    print(f'  {pos}: {snip[:80]}')
    
# Also find what tabs are available
tab_ids = re.findall(r"switchTab\(['\"]([^'\"]+)['\"]", html)
print('Tab IDs referenced:', sorted(set(tab_ids)))

# Find last occurrence of tab-content closing
last = matches[-1][0] if matches else 0
print()
print('Context around last tab-content:')
print(html[last:last+300])
