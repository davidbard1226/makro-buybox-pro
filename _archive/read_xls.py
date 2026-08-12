import xlrd
wb = xlrd.open_workbook(r'C:\Users\David\Downloads\S_listing--ui--group_c81decf9734a482a_2202-211749_default.xls')
sh = wb.sheet_by_index(0)
print("Rows:", sh.nrows, "Cols:", sh.ncols)
for r in range(min(4, sh.nrows)):
    row = [str(sh.cell_value(r,c)) for c in range(min(15, sh.ncols))]
    print(row)
