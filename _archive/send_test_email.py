import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = 'cp64-jhb.za-dns.com'
SMTP_PORT = 465
SENDER = 'info@onlinetechhub.co.za'
PASSWORD = 'TechHub@2026!'

def send_test(to_email, label):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = 'Test Email - Online TechHub ' + label
    msg['From'] = 'Online TechHub <info@onlinetechhub.co.za>'
    msg['To'] = to_email

    text = 'This is a test email for Online TechHub. Your ' + label + ' email is working!'

    html = (
        '<div style="font-family:Arial;background:#111;color:#f0f0f0;padding:30px;max-width:500px;">'
        '<h1 style="margin:0 0 8px;">Online<span style="color:#f97316;">TechHub</span></h1>'
        '<h2 style="color:#22c55e;margin:0 0 16px;">Email is Working!</h2>'
        '<p>Your <strong style="color:#f97316;">' + label + '</strong> email account is set up correctly.</p>'
        '<hr style="border:1px solid #2a2a2a;margin:20px 0;"/>'
        '<p style="color:#888;font-size:12px;">onlinetechhub.co.za</p>'
        '</div>'
    )

    msg.attach(MIMEText(text, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as server:
        server.login(SENDER, PASSWORD)
        server.sendmail(SENDER, to_email, msg.as_string())
    print('Sent to ' + to_email + ' OK!')

try:
    send_test('info@onlinetechhub.co.za', 'info@onlinetechhub.co.za')
    send_test('orders@onlinetechhub.co.za', 'orders@onlinetechhub.co.za')
    print('')
    print('Both test emails sent! Check Outlook now.')
except Exception as e:
    print('Error: ' + str(e))
