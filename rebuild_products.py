import csv, re, json, os

def clean_price(p):
    return round(float(re.sub(r'[=""]', '', str(p)).strip()), 2)

def clean_code(c):
    return re.sub(r'[=""]', '', str(c)).strip()

def get_main_cat(category):
    cat = category.lower()
    if any(x in cat for x in ['notebook','laptop','desktop','workstation','chromebook']): return 'Laptops & Computers'
    if any(x in cat for x in ['monitor','television','tv','interactive','display']): return 'Monitors & Displays'
    if any(x in cat for x in ['network','access point','router','switch','wireless','wifi','firewall','modem','nas','storage','hard disk','ssd','flash','memory card']): return 'Networking & Storage'
    if any(x in cat for x in ['printer','ink','toner','scanner']): return 'Printers & Ink'
    if any(x in cat for x in ['headphone','earphone','speaker','microphone','webcam','camera','cctv','projector']): return 'Audio & Visual'
    if any(x in cat for x in ['phone','ipad','iphone','samsung','tablet','cellular']): return 'Mobile & Tablets'
    if any(x in cat for x in ['solar','ups','battery','power bank','inverter']): return 'Power & Solar'
    if any(x in cat for x in ['air con','kettle','microwave','vacuum','iron','humidif','fan','heater','fridge','coffee','appliance']): return 'Appliances'
    if any(x in cat for x in ['gaming','playstation','xbox','nintendo','controller']): return 'Gaming'
    if any(x in cat for x in ['cable','adapter','hub','charger','mouse','keyboard','bag','case','cover','stand','tool']): return 'Accessories'
    return 'General'

def smart_price(cost):
    if cost <= 50:    return round(cost * 1.60 + 120)
    elif cost <= 150: return round(cost * 1.60 + 90)
    elif cost <= 300: return round(cost * 1.55 + 60)
    elif cost <= 500: return round(cost * 1.45 + 40)
    elif cost <= 1000:return round(cost * 1.30 + 20)
    elif cost <= 2000:return round(cost * 1.20)
    elif cost <= 5000:return round(cost * 1.15)
    elif cost <= 20000:return round(cost * 1.10)
    else:             return round(cost * 1.08)

# Load manual price overrides
overrides = {}
override_file = r'C:\Users\David\makro-buybox-pro\price_overrides.txt'
if os.path.exists(override_file):
    with open(override_file, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if '=' in line:
                parts = line.split('=', 1)
                sku = parts[0].strip().upper()
                try:
                    price = round(float(parts[1].strip()))
                    overrides[sku] = price
                except: pass
    print(f'Loaded {len(overrides)} price override(s): {list(overrides.keys())}')
else:
    print('No overrides file found - using formula only')

# Find the CSV file
csv_candidates = [
    r'C:\Users\David\Downloads\DataFeed_2026-03-20.csv',
    r'C:\Users\David\Documents\DataFeed_2026-03-20.csv',
    r'C:\Users\David\Desktop\DataFeed_2026-03-20.csv',
]
csv_file = None
for p in csv_candidates:
    if os.path.exists(p):
        csv_file = p
        break

if not csv_file:
    # Search Downloads for any DataFeed csv
    import glob
    found = glob.glob(r'C:\Users\David\Downloads\DataFeed*.csv')
    if found:
        csv_file = sorted(found)[-1]  # latest one

if not csv_file:
    print('ERROR: Could not find DataFeed CSV!')
    print('Please place the Esquire CSV in Downloads folder')
    exit(1)

print(f'Using CSV: {csv_file}')

# Build products
products = []
override_count = 0
with open(csv_file, encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for row in reader:
        cost = clean_price(row['Price'])
        if cost <= 0: continue
        qty_str = str(row['AvailableQty']).strip()
        try: qty = int(float(qty_str))
        except: qty = 0
        code = clean_code(row['ProductCode'])
        # Check for manual override
        if code.upper() in overrides:
            sale_price = overrides[code.upper()]
            override_count += 1
        else:
            sale_price = smart_price(cost)
        products.append({
            'id': len(products)+1,
            'name': row['ProductName'].strip(),
            'code': code,
            'category': row['Category'].strip(),
            'mainCat': get_main_cat(row['Category']),
            'summary': row['ProductSummary'].strip()[:500],
            'cost': cost,
            'price': sale_price,
            'qty': qty,
            'image': row['Image'].strip()
        })

print(f'Built {len(products):,} products ({override_count} with manual overrides)')

# Stats
prices = [p['price'] for p in products]
costs = [p['cost'] for p in products]
margins = [p['price']-p['cost'] for p in products]
print(f'Avg cost:   R{sum(costs)/len(costs):.0f}')
print(f'Avg price:  R{sum(prices)/len(prices):.0f}')
print(f'Avg margin: R{sum(margins)/len(margins):.0f}')

# Sample cheap products to verify
print('\nSample cheap products (verify pricing):')
cheap = sorted([p for p in products if p['cost'] <= 50], key=lambda x: x['cost'])[:5]
for p in cheap:
    net = p['price'] - p['cost'] - 120
    print(f"  R{p['cost']:6.0f} cost → R{p['price']:6.0f} price | Profit after R120 ship: R{net:.0f} | {p['name'][:40]}")

print('\nSample mid products:')
mid = [p for p in products if 200 <= p['cost'] <= 500][:3]
for p in mid:
    net = p['price'] - p['cost'] - 120
    print(f"  R{p['cost']:6.0f} cost → R{p['price']:6.0f} price | Profit after R120 ship: R{net:.0f} | {p['name'][:40]}")

# Save
pdata = json.dumps(products, separators=(',', ':'))
with open(r'C:\Users\David\makro-buybox-pro\products_smart.json', 'w') as f:
    f.write(pdata)
print(f'\nSaved: {len(pdata)/1024/1024:.1f} MB')
