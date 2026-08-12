with open(r'C:\Users\David\makro-buybox-pro\index.html', encoding='utf-8') as f:
    html = f.read()

# Find the intelligence tab panel and what comes after it
idx = html.find('id="tab-intelligence"')
print('intelligence tab at:', idx)
# Find its closing - look for next tab-content or </main> or </body>
after = html[idx:]
next_tab = after.find('<div class="tab-content"', 50)
print('Next tab-content at offset:', next_tab)
if next_tab > 0:
    print(html[idx+next_tab-100:idx+next_tab+100])
else:
    # Find end of this panel
    close = after.rfind('</div>')
    print('Context near end:')
    print(html[idx+len(after)-500:idx+len(after)-200])
