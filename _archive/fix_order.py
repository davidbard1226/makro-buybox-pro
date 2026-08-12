import ftplib, io, urllib.request, ssl, re

FTP_HOST = 'cp64-jhb.za-dns.com'
FTP_USER = 'onlinete'
FTP_PASS = '8Z7z3s*OB*bjM9'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print('Downloading live site...')
html = urllib.request.urlopen(urllib.request.Request(
    'https://onlinetechhub.co.za',
    headers={'User-Agent':'Mozilla/5.0'}), context=ctx, timeout=20
).read().decode('utf-8','ignore')
print('Downloaded:', len(html), 'chars')

# ── FIND AND REPLACE THE ENTIRE submitOrder FUNCTION ─────────────
func_start = html.find('function submitOrder()')
if func_start == -1:
    print('ERROR: submitOrder not found')
    exit(1)

# Find the end of the function by tracking braces
depth = 0
func_end = func_start
i = func_start
while i < len(html):
    if html[i] == '{':
        depth += 1
    elif html[i] == '}':
        depth -= 1
        if depth == 0:
            func_end = i + 1
            break
    i += 1

old_func = html[func_start:func_end]
print('Found submitOrder, length:', len(old_func))

# New fixed submitOrder - uses id="orderConfirm" so Done button always works
NEW_FUNC = r"""function submitOrder(){
  const fn=document.getElementById("fn").value.trim();
  const ln=document.getElementById("ln").value.trim();
  const em=document.getElementById("em").value.trim();
  const ph=document.getElementById("ph").value.trim();
  const ad=document.getElementById("ad").value.trim();
  if(!fn||!ln||!em||!ph||!ad){toast("Please fill in all fields");return;}

  const tot=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const oid="OTH-"+Date.now();
  const itemList=cart.map(i=>i.name.slice(0,30)+" x"+i.qty+" = R"+fmt(i.price*i.qty)).join("\n");

  // Close checkout modal
  document.getElementById("chkmo").classList.remove("open");

  // Remove any existing order confirm overlay
  const existing=document.getElementById("orderConfirm");
  if(existing)existing.remove();

  // Build confirmation overlay with unique ID
  const overlay=document.createElement("div");
  overlay.id="orderConfirm";
  overlay.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";

  overlay.innerHTML='<div style="background:var(--bg2);border:2px solid var(--orange);border-radius:14px;max-width:500px;width:100%;padding:32px;text-align:center;position:relative;">'
    +'<div style="font-size:52px;margin-bottom:12px">✅</div>'
    +'<h2 style="font-family:var(--font-head);font-size:26px;margin-bottom:8px;color:var(--orange)">Order Placed!</h2>'
    +'<p style="color:var(--muted);font-size:14px;margin-bottom:20px">Thank you <strong style="color:var(--text)">'+fn+'</strong>! Your order <strong style="color:var(--orange)">'+oid+'</strong> has been received.</p>'
    +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:18px;text-align:left;margin-bottom:20px">'
      +'<div style="font-family:var(--font-head);font-size:16px;color:var(--orange);margin-bottom:12px">🏦 Please make EFT payment:</div>'
      +'<div style="font-size:13px;line-height:2.4;color:var(--text);">'
        +'<b>Bank:</b> Capitec Business<br/>'
        +'<b>Account Name:</b> ONLINETECHHUB (PTY) LTD<br/>'
        +'<b>Account Number:</b> <span style="color:var(--orange);font-weight:700;font-size:15px">1055027882</span><br/>'
        +'<b>Branch Code:</b> 450105<br/>'
        +'<b>Account Type:</b> Business Current<br/>'
        +'<b>Reference:</b> <span style="color:var(--orange);font-weight:700;font-size:15px">'+oid+'</span><br/>'
        +'<b>Amount:</b> <span style="color:var(--orange);font-weight:700;font-size:18px">R'+fmt(tot)+'</span>'
      +'</div>'
    +'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:20px;line-height:1.6">'
      +'📧 Confirmation sent to <strong style="color:var(--text)">'+em+'</strong><br/>'
      +'We confirm your order within 2-4 hours of payment. Delivery nationwide.'
    +'</p>'
    +'<button onclick="document.getElementById(\'orderConfirm\').remove()" '
      +'style="background:var(--orange);border:none;color:#fff;padding:14px 40px;border-radius:8px;font-family:var(--font-head);font-size:18px;font-weight:700;cursor:pointer;width:100%;transition:background .2s;" '
      +'onmouseover="this.style.background=\'#ea6a0a\'" onmouseout="this.style.background=\'var(--orange)\'">'
      +'Done — Close'
    +'</button>'
  +'</div>';

  document.body.appendChild(overlay);

  // Clear cart
  cart=[];
  saveCart();
  updateCC();
}"""

html = html.replace(old_func, NEW_FUNC)
print('submitOrder replaced')

# Verify fix
print('Has orderConfirm id:', 'orderConfirm' in html)
print('Has Done button:', "document.getElementById('orderConfirm').remove()" in html)
print('Old closest method gone:', "closest('div[style]')" not in html)

print('Uploading fix...')
ftp = ftplib.FTP()
ftp.connect(FTP_HOST, 21, timeout=60)
ftp.login(FTP_USER, FTP_PASS)
ftp.cwd('public_html')
data = html.encode('utf-8')
up=[0]
def prog(b):
    up[0]+=len(b)
    if up[0]%(500*1024)<8192: print(f'  {up[0]/len(data)*100:.0f}%')
ftp.storbinary('STOR index.html', io.BytesIO(data), 8192, prog)
print('LIVE!', ftp.size('index.html'), 'bytes')
ftp.quit()
print()
print('Fixed: Order confirmation Done button now uses id="orderConfirm"')
print('Test by placing a dummy order at https://onlinetechhub.co.za')
