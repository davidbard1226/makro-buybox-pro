import struct, re, json, os

chrome_base = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
profiles = ["Default", "Profile 12"]

all_data = {}

for profile in profiles:
    ldb_path = os.path.join(chrome_base, profile, "Local Storage", "leveldb")
    if not os.path.exists(ldb_path):
        continue
    for fname in os.listdir(ldb_path):
        if not fname.endswith(".ldb"):
            continue
        fpath = os.path.join(ldb_path, fname)
        try:
            with open(fpath, "rb") as f:
                raw = f.read()
            text = raw.decode("utf-8", errors="replace")
            # Find makro_buybox_v2 value
            for key in ["makro_buybox_v2", "makro_listings", "makro_costs", "makro_seller_name"]:
                idx = text.find(key)
                while idx != -1:
                    # Value starts after the key + some bytes
                    chunk = text[idx:idx+500000]
                    # Find JSON array or object
                    m = re.search(r'(\[.*?\]|\{.*?\})', chunk[len(key):len(key)+400000], re.DOTALL)
                    if m:
                        val = m.group(1)
                        if len(val) > 50:
                            if key not in all_data or len(val) > len(all_data[key]):
                                all_data[key] = val
                                print(f"[{profile}/{fname}] Found {key}: {len(val)} chars")
                    idx = text.find(key, idx+1)
        except Exception as e:
            pass

print("\n=== SUMMARY ===")
for k, v in all_data.items():
    print(f"{k}: {len(v)} chars")
    try:
        parsed = json.loads(v)
        if isinstance(parsed, list):
            print(f"  -> {len(parsed)} items")
            if parsed:
                print(f"  -> First: {json.dumps(parsed[0])[:200]}")
        elif isinstance(parsed, dict):
            print(f"  -> {len(parsed)} keys")
    except Exception as e:
        print(f"  -> parse error: {e}")
        print(f"  -> raw start: {v[:200]}")

# Save extracted data
with open("extracted_data.json", "w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2)
print("\nSaved to extracted_data.json")
