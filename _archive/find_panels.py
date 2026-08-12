with open(r'C:\Users\David\makro-buybox-pro\index.html', encoding='utf-8') as f:
    html = f.read()
# Find tab panels 
import re
panels = [(m.start(), m.group()) for m in re.finditer(r'<div[^>]+id=["\'](?:dashboard|products|scraper|pricer|analytics|log)["\']', html)]
print('Panels found:')
for pos, tag in panels:
    print(f'  pos={pos}: {tag}')
print()
# Find the last panel and its closing
last_pos, last_tag = panels[-1]
print('Last panel at:', last_pos, last_tag[:50])
# Find next major section after last panel
after = html[last_pos+100:]
close_idx = after.find('</section>') 
if close_idx < 0: close_idx = after.find('\n\n  <')
print('Approx close at offset:', close_idx)
print('Context around close:')
print(html[last_pos+100+close_idx-100:last_pos+100+close_idx+200])
