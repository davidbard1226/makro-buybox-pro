import urllib.request, ssl, json, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── TEST ORDER DATA ───────────────────────────────────────────────
test_order = {
    "firstName": "Test",
    "lastName": "Customer",
    "email": "orders@onlinetechhub.co.za",
    "phone": "0821234567",
    "address": "123 Test Street, Johannesburg, 2000",
    "orderId": "OTH-TEST-" + str(__import__('time').time_ns())[:13],
    "total": "1299",
    "payMethod": "EFT",
    "items": [
        {"name": "Logitech Wireless Mouse M185", "qty": 1, "price": 299},
        {"name": "HP 123 Black Ink Cartridge", "qty": 2, "price": 199},
        {"name": "USB-C Charging Cable 2m", "qty": 1, "price": 149},
    ]
}

print("=== SIMULATING LIVE ORDER ===")
print(f"Order ID: {test_order['orderId']}")
print(f"Customer: {test_order['firstName']} {test_order['lastName']}")
print(f"Email: {test_order['email']}")
print(f"Total: R{test_order['total']}")
print(f"Items: {len(test_order['items'])} products")
print()

# ── CALL THE PHP EMAIL SCRIPT ─────────────────────────────────────
print("Step 1: Calling order-mail.php on live server...")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    data = json.dumps(test_order).encode('utf-8')
    req = urllib.request.Request(
        'https://onlinetechhub.co.za/order-mail.php',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req, context=ctx, timeout=15)
    result = json.loads(resp.read().decode())
    print(f"PHP Response: {result}")
    print(f"  Customer email sent: {result.get('sentCustomer')}")
    print(f"  Seller email sent:   {result.get('sentSeller')}")
    print(f"  Order ID:            {result.get('orderId')}")
except Exception as e:
    print(f"PHP call error: {e}")
    print("Falling back to direct SMTP...")

# ── DIRECT SMTP FALLBACK (in case PHP mail is blocked) ───────────
import imaplib, email as emaillib, time

SMTP_HOST = 'cp64-jhb.za-dns.com'
SMTP_PORT = 465
IMAP_HOST = 'cp64-jhb.za-dns.com'
IMAP_PORT = 993

def send_email(smtp_user, smtp_pass, to, subject, html_body):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'Online TechHub <{smtp_user}>'
    msg['To'] = to
    msg.attach(MIMEText('Please view in HTML email client.', 'plain'))
    msg.attach(MIMEText(html_body, 'html'))
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as s:
        s.login(smtp_user, smtp_pass)
        s.sendmail(smtp_user, to, msg.as_string())

oid = test_order['orderId']
total = test_order['total']
fn = test_order['firstName']
em = test_order['email']
items_html = ''.join([
    f"<tr><td style='padding:8px;border-bottom:1px solid #2a2a2a;color:#f0f0f0;font-size:13px;'>{i['name']}</td>"
    f"<td style='padding:8px;border-bottom:1px solid #2a2a2a;color:#f0f0f0;font-size:13px;text-align:center;'>{i['qty']}</td>"
    f"<td style='padding:8px;border-bottom:1px solid #2a2a2a;color:#f97316;font-size:13px;text-align:right;font-weight:700;'>R{i['price']*i['qty']}</td></tr>"
    for i in test_order['items']
])

print()
print("Step 2: Sending emails directly via SMTP...")

# Customer email
customer_html = f"""<div style="font-family:Arial;background:#0a0a0a;padding:0;margin:0;">
<div style="max-width:580px;margin:auto;">
<div style="background:#111;border-bottom:3px solid #f97316;padding:24px 32px;text-align:center;">
  <h1 style="margin:0;color:#f0f0f0;font-size:24px;letter-spacing:2px;">Online<span style="color:#f97316;">TechHub</span></h1>
  <p style="margin:4px 0 0;color:#888;font-size:12px;">South Africa's Tech Destination</p>
</div>
<div style="background:#161616;padding:32px;text-align:center;">
  <div style="font-size:48px;margin-bottom:12px;">✅</div>
  <h2 style="color:#f97316;font-size:22px;margin:0 0 8px;">Order Confirmed!</h2>
  <p style="color:#888;font-size:14px;margin:0 0 20px;">Thank you <strong style="color:#f0f0f0;">{fn}</strong>! Your order has been received.</p>
  <div style="background:#1a0e00;border:1px solid #f97316;border-radius:8px;padding:10px 20px;display:inline-block;">
    <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Order Reference</p>
    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#f97316;letter-spacing:2px;">{oid}</p>
  </div>
</div>
<div style="background:#111;padding:24px 32px;">
  <h3 style="color:#f0f0f0;font-size:14px;border-bottom:1px solid #2a2a2a;padding-bottom:10px;margin:0 0 16px;">🛒 Order Summary</h3>
  <table width="100%" style="border-collapse:collapse;">
    <tr style="background:#1a1a1a;">
      <th style="padding:8px;color:#888;font-size:11px;text-align:left;">Product</th>
      <th style="padding:8px;color:#888;font-size:11px;text-align:center;">Qty</th>
      <th style="padding:8px;color:#888;font-size:11px;text-align:right;">Amount</th>
    </tr>
    {items_html}
    <tr><td colspan="2" style="padding:10px 8px;color:#888;font-size:13px;"><strong style="color:#f0f0f0;">TOTAL</strong></td>
    <td style="padding:10px 8px;color:#f97316;font-size:18px;font-weight:700;text-align:right;">R{total}</td></tr>
  </table>
</div>
<div style="background:#161616;padding:24px 32px;">
  <h3 style="color:#f0f0f0;font-size:14px;margin:0 0 16px;">🏦 Please Make EFT Payment</h3>
  <table width="100%" style="border-collapse:collapse;background:#111;border-radius:8px;">
    <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;"><span style="color:#888;font-size:11px;">Bank</span><br/><strong style="color:#f0f0f0;">Capitec Business</strong></td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;"><span style="color:#888;font-size:11px;">Account Name</span><br/><strong style="color:#f0f0f0;">ONLINETECHHUB (PTY) LTD</strong></td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;"><span style="color:#888;font-size:11px;">Account Number</span><br/><strong style="color:#f97316;font-size:18px;letter-spacing:2px;">1055027882</strong></td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;"><span style="color:#888;font-size:11px;">Branch Code</span><br/><strong style="color:#f0f0f0;">450105</strong></td></tr>
    <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;"><span style="color:#888;font-size:11px;">Reference (USE THIS EXACTLY)</span><br/><strong style="color:#f97316;font-size:18px;letter-spacing:2px;">{oid}</strong></td></tr>
    <tr><td style="padding:10px 16px;"><span style="color:#888;font-size:11px;">Amount to Pay</span><br/><strong style="color:#f97316;font-size:22px;font-weight:700;">R{total}</strong></td></tr>
  </table>
  <p style="color:#888;font-size:11px;margin-top:14px;line-height:1.6;">Orders are processed within 2-4 hours of payment confirmation. Nationwide delivery.</p>
</div>
<div style="background:#111;padding:16px 32px;text-align:center;border-top:1px solid #2a2a2a;">
  <p style="color:#888;font-size:12px;margin:0;">Questions? 📧 info@onlinetechhub.co.za | 💬 WhatsApp: 069 691 3518</p>
  <p style="color:#444;font-size:11px;margin:8px 0 0;">© 2026 Online TechHub (Pty) Ltd · onlinetechhub.co.za</p>
</div>
</div></div>"""

# Seller notification
seller_html = f"""<div style="font-family:Arial;background:#0a0a0a;padding:20px;">
<div style="max-width:580px;margin:auto;background:#111;border-radius:12px;border:2px solid #f97316;overflow:hidden;">
  <div style="background:#f97316;padding:18px 24px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">🛒 NEW ORDER RECEIVED!</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px;">Order: <strong>{oid}</strong> · Total: <strong>R{total}</strong></p>
  </div>
  <div style="padding:24px;">
    <h3 style="color:#f97316;margin:0 0 12px;font-size:14px;">Customer Details</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#888;font-size:13px;width:120px;">Name</td><td style="padding:6px 0;color:#f0f0f0;font-size:13px;font-weight:700;">{test_order['firstName']} {test_order['lastName']}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px;">Email</td><td style="padding:6px 0;color:#f97316;font-size:13px;">{test_order['email']}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px;">Phone</td><td style="padding:6px 0;color:#f0f0f0;font-size:13px;">{test_order['phone']}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px;">Address</td><td style="padding:6px 0;color:#f0f0f0;font-size:13px;">{test_order['address']}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px;">Payment</td><td style="padding:6px 0;color:#f0f0f0;font-size:13px;">{test_order['payMethod']}</td></tr>
    </table>
    <h3 style="color:#f97316;margin:0 0 12px;font-size:14px;">Items Ordered</h3>
    <table width="100%" style="border-collapse:collapse;background:#161616;border-radius:8px;overflow:hidden;">
      <tr style="background:#1a1a1a;"><th style="padding:8px 12px;color:#888;font-size:11px;text-align:left;">Product</th><th style="padding:8px;color:#888;font-size:11px;text-align:center;">Qty</th><th style="padding:8px;color:#888;font-size:11px;text-align:right;">Amount</th></tr>
      {items_html}
      <tr><td colspan="2" style="padding:10px 12px;color:#888;font-size:13px;">TOTAL</td><td style="padding:10px 12px;color:#f97316;font-size:18px;font-weight:700;text-align:right;">R{total}</td></tr>
    </table>
    <div style="margin-top:20px;background:#1a0e00;border:1px solid #f97316;border-radius:8px;padding:14px;">
      <p style="margin:0;color:#f97316;font-size:13px;font-weight:700;">⚡ Action: Check Capitec app for payment reference <strong>{oid}</strong>, then arrange delivery to {test_order['address']}</p>
    </div>
  </div>
</div></div>"""

try:
    send_email('info@onlinetechhub.co.za', 'TechHub@2026!',
               test_order['email'],
               f"Order Confirmed: {oid} — Online TechHub",
               customer_html)
    print("  Customer email sent OK!")
except Exception as e:
    print(f"  Customer email error: {e}")

try:
    send_email('info@onlinetechhub.co.za', 'TechHub@2026!',
               'orders@onlinetechhub.co.za',
               f"NEW ORDER {oid} — R{total} — Online TechHub",
               seller_html)
    print("  Seller email sent OK!")
except Exception as e:
    print(f"  Seller email error: {e}")

# ── VERIFY EMAILS ARRIVED ─────────────────────────────────────────
print()
print("Step 3: Verifying emails arrived in inboxes...")
time.sleep(3)

for addr, pwd in [('orders@onlinetechhub.co.za','TechHub@2026!'), ('info@onlinetechhub.co.za','TechHub@2026!')]:
    try:
        ctx2 = ssl.create_default_context()
        ctx2.check_hostname = False
        ctx2.verify_mode = ssl.CERT_NONE
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=ctx2)
        mail.login(addr, pwd)
        mail.select('INBOX')
        status, msgs = mail.search(None, 'ALL')
        count = len(msgs[0].split()) if msgs[0] else 0
        print(f"  {addr}: {count} email(s) in inbox")
        if count > 0:
            latest = msgs[0].split()[-1]
            _, data = mail.fetch(latest, '(RFC822)')
            msg = emaillib.message_from_bytes(data[0][1])
            print(f"    Latest: {msg.get('Subject','')}")
        mail.logout()
    except Exception as e:
        print(f"  {addr}: Error - {e}")

print()
print("=== TEST COMPLETE ===")
print("Check your Outlook - both inboxes should have the order emails!")
print("orders@ should have the NEW ORDER notification")
print("info@ (sent as) is the sender - check orders@ for seller notification")
