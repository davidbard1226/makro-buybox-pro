import re
html = open('index.html', encoding='utf-8').read()
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
open('_test.js', 'w', encoding='utf-8').write(scripts[1])
print('extracted', len(scripts[1]), 'chars')
