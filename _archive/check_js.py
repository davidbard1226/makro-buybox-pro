content = open('index.html', encoding='utf-8').read()
s = content.count('<script')
e = content.count('</script>')
print('script tags open:', s, 'close:', e)
checks = [
    'function generateUrlsFromListings',
    'function clearUrlInput',
    'function startScraping',
    'function switchTab',
    'function loadProducts',
    'function renderProducts',
    'function renderDashboard',
    'function initPricer',
    'function getListings',
    'function saveProducts',
]
for c in checks:
    print(c + ':', 'OK' if c in content else 'MISSING')

# Check for unclosed template literals or obvious breaks
lines = content.split('\n')
print('Total lines:', len(lines))

# Find all script blocks
import re
scripts = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
print('Inline script blocks:', len(scripts))
for i, sc in enumerate(scripts):
    print(f'  Block {i}: {len(sc)} chars')
