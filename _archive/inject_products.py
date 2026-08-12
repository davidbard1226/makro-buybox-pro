import json, re

products = json.load(open("products_smart.json", encoding="utf-8-sig"))
html = open("index.html", encoding="utf-8").read()

tag_id = "products-data"
inline = "<script id=\"" + tag_id + "\">var PRODUCTS_SMART = " + json.dumps(products, ensure_ascii=False) + ";</script>"

if ("<script id=\"" + tag_id + "\">") in html:
    html = re.sub(r"<script id=\"products-data\">.*?</script>", inline, html, flags=re.DOTALL)
    print("Replaced existing products-data block")
else:
    html = html.replace("</head>", inline + "\n</head>", 1)
    print("Injected new products-data block before </head>")

open("index.html", "w", encoding="utf-8").write(html)
print("Done. Products injected:", len(products))
