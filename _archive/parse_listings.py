import xlrd, json
wb = xlrd.open_workbook(r'C:\Users\David\Downloads\S_listing--ui--group_c81decf9734a482a_2202-211749_default.xls')
sh = wb.sheet_by_index(0)
products = []
for r in range(2, sh.nrows):  # skip 2 header rows
    try:
        title    = str(sh.cell_value(r, 0)).strip()
        sku      = str(sh.cell_value(r, 1)).strip()
        fsn      = str(sh.cell_value(r, 4)).strip()
        status   = str(sh.cell_value(r, 6)).strip()
        price_raw = sh.cell_value(r, 9)
        stock_raw = sh.cell_value(r, 12)
        price = float(price_raw) if price_raw != '' else 0
        stock = int(float(stock_raw)) if stock_raw != '' else 0
        if fsn and title:
            products.append({'title':title,'sku':sku,'fsn':fsn,'status':status,'myPrice':price,'myStock':stock})
    except: pass
print(json.dumps(products[:5], indent=2))
print("Total:", len(products))
