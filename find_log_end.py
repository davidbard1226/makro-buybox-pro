with open(r'C:\Users\David\makro-buybox-pro\index.html', encoding='utf-8') as f:
    html = f.read()
# Find the log tab panel end
idx = html.rfind("id='log'") 
if idx < 0: idx = html.rfind('id="log"')
print('log panel at:', idx)
print(html[idx:idx+200])
print()
# Find closing </div> for the tab-content after log
end = html.find('</div>', idx+100)
print('end at:', end)
print(html[end-50:end+200])
