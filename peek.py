lines=open('C:/Users/David/makro-buybox-pro/index.html').readlines()
for i,l in enumerate(lines[1989:2210],1990):
    print(str(i)+': '+l,end='')
