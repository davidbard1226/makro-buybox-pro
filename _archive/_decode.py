import urllib.request, os
print("Downloading fixed index.html from GitHub...")
url = "https://raw.githubusercontent.com/davidbard1226/makro-buybox-pro/main/index.html"
# GitHub has the bridge.js fix but NOT the index.html fix yet (index.html wasn't decoded properly)
# Instead, pull from the outputs we have
import base64
with open("C:/Users/David/makro-buybox-pro/_index_b64.txt", "r") as f:
    b64 = f.read().strip()
data = base64.b64decode(b64)
with open("C:/Users/David/makro-buybox-pro/index.html", "wb") as f:
    f.write(data)
if os.path.exists("C:/Users/David/makro-buybox-pro/_index_b64.txt"):
    os.remove("C:/Users/David/makro-buybox-pro/_index_b64.txt")
print("Written " + str(len(data)) + " bytes")
