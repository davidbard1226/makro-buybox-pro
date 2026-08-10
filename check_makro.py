import urllib.request, re, json

url = "https://www.makro.co.za/search?q=printer"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
try:
    html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
except Exception as e:
    print("FETCH ERROR:", e)
    exit()

print("Page size (bytes):", len(html))

# Check what kind of page this is
if "Just a moment" in html or "cf-browser-verification" in html:
    print("BLOCKED: Cloudflare challenge page")
elif "search" in html.lower():
    print("Got a search page (good)")

# Find /p/ links
links = re.findall(r"href=[\"'](https?://www\.makro\.co\.za[^\"']*?/p/[^\"']+)[\"']", html)
print("=== /p/ links found:", len(links))
for l in links[:10]:
    print(" ", l)

# Check for __NEXT_DATA__
if "__NEXT_DATA__" in html:
    print("\nHas __NEXT_DATA__ (React SSR)")
    m = re.search(r"<script id=\"__NEXT_DATA__\" type=\"application/json\">(.*?)</script>", html, re.DOTALL)
    if m:
        try:
            nd = json.loads(m.group(1))
            print("__NEXT_DATA__ keys:", list(nd.keys()))
        except:
            print("Could not parse __NEXT_DATA__")
else:
    print("\nNo __NEXT_DATA__ found")

# Look for any product-like JSON
prod_matches = re.findall(r'"url"\s*:\s*"(https://www\.makro\.co\.za[^"]+/p/[^"]+)"', html)
print("\nProduct URLs in JSON blobs:", len(prod_matches))
for u in prod_matches[:5]:
    print(" ", u)
