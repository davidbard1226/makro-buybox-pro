import urllib.request

url = "https://www.makro.co.za/search?q=printer"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")

# Print first 3000 chars to see page structure
print(html[:3000])
