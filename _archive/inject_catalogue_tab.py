with open(r'C:\Users\David\makro-buybox-pro\index.html', encoding='utf-8') as f:
    html = f.read()

import re, json

# The catalogue panel HTML to inject
PANEL = '''
  <!-- CATALOGUE SEARCH TAB -->
  <div class="tab-content" id="tab-catalogue">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="card-title" style="margin:0">🔍 MAKRO CATALOGUE URL FINDER</div>
      <span style="font-size:12px;color:var(--muted)">Automatically finds Makro product URLs for your Esquire catalogue</span>
    </div>

    <div id="catExtBanner" style="display:none;padding:10px 14px;border-radius:8px;background:rgba(255,100,0,.1);border:1px solid rgba(255,100,0,.3);color:#ff6b35;font-size:13px;margin-bottom:16px">
      ⚠️ Extension offline — install and enable the BuyBox Pro extension first
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-val" id="catTotalProducts">0</div>
        <div class="stat-label">Esquire Products</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="catMatchedCount" style="color:var(--green,#4caf50)">0</div>
        <div class="stat-label">URLs Found</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="catRemainingCount" style="color:var(--orange)">0</div>
        <div class="stat-label">Still to Search</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="catProgressPct">0%</div>
        <div class="stat-label">Progress</div>
      </div>
    </div>

    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">Search Settings</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <label style="font-size:12px;color:var(--muted)">
          Tabs:
          <select id="catConcurrency" style="margin-left:6px;font-size:12px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text)">
            <option value="1">1 (safe)</option>
            <option value="2" selected>2 (recommended)</option>
            <option value="3">3 (fast)</option>
          </select>
        </label>
        <label style="font-size:12px;color:var(--muted)">
          Category filter:
          <select id="catCategory" style="margin-left:6px;font-size:12px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text)">
            <option value="">All categories</option>
            <option value="printer">Printers</option>
            <option value="laptop">Laptops</option>
            <option value="monitor">Monitors</option>
            <option value="router">Networking</option>
            <option value="gaming">Gaming</option>
            <option value="camera">Cameras/CCTV</option>
            <option value="ups">UPS/Solar</option>
            <option value="headphone">Headsets/Audio</option>
            <option value="keyboard">Keyboards/Mice</option>
          </select>
        </label>
        <label style="font-size:12px;color:var(--muted)">
          Max searches:
          <input type="number" id="catMaxSearch" value="200" min="10" max="4000"
            style="margin-left:6px;width:70px;font-size:12px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text)"/>
        </label>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <button id="catStartBtn" onclick="catSearchStart()"
        style="background:var(--orange);border:none;color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
        ▶ Start Catalogue Search
      </button>
      <button id="catStopBtn" onclick="catSearchStop()" disabled
        style="background:var(--bg2);border:1px solid var(--border);color:var(--muted);padding:10px 22px;border-radius:8px;font-size:13px;cursor:not-allowed">
        ⏹ Stop
      </button>
      <button onclick="catDownloadXLS()"
        style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:10px 22px;border-radius:8px;font-size:13px;cursor:pointer">
        ⬇ Download Matched XLS
      </button>
      <button onclick="catClearResults()"
        style="background:var(--bg2);border:1px solid var(--border);color:var(--muted);padding:10px 16px;border-radius:8px;font-size:12px;cursor:pointer">
        🗑 Clear Results
      </button>
    </div>

    <div id="catProgressBar" style="display:none;height:6px;background:var(--border);border-radius:3px;margin-bottom:12px;overflow:hidden">
      <div id="catProgressFill" style="height:100%;background:var(--orange);width:0%;transition:width .3s;border-radius:3px"></div>
    </div>

    <div id="catStatusMsg" style="font-size:12px;color:var(--muted);margin-bottom:16px;min-height:18px"></div>

    <div id="catResultsTable" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:13px;font-weight:600">Matched Products</div>
        <input id="catSearch" placeholder="Search results..." oninput="catFilterResults()"
          style="font-size:12px;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);width:200px"/>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:var(--bg2);color:var(--muted)">
              <th style="padding:8px 10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">SKU</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Esquire Product</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Makro Title</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Makro URL</th>
              <th style="padding:8px 10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Action</th>
            </tr>
          </thead>
          <tbody id="catResultsBody"></tbody>
        </table>
      </div>
    </div>
  </div>
'''

# Find the closing </main> or the script section to inject before
# Look for the pattern that ends all tab-content panels
insert_marker = '</main>'
if insert_marker not in html:
    insert_marker = '<script>'

idx = html.find(insert_marker)
if idx > 0:
    new_html = html[:idx] + PANEL + '\n  ' + html[idx:]
    print('Injected panel before:', insert_marker, 'at position', idx)
else:
    print('ERROR: Could not find injection point')
    exit(1)

with open(r'C:\Users\David\makro-buybox-pro\index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
print('Panel injected successfully!')
print('File size:', len(new_html))
