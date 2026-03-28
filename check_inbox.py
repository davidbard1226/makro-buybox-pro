import imaplib, email

IMAP_HOST = 'cp64-jhb.za-dns.com'
IMAP_PORT = 993

accounts = [
    ('info@onlinetechhub.co.za', 'TechHub@2026!'),
    ('orders@onlinetechhub.co.za', 'TechHub@2026!'),
]

for addr, pwd in accounts:
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(addr, pwd)
        mail.select('INBOX')
        status, msgs = mail.search(None, 'ALL')
        count = len(msgs[0].split()) if msgs[0] else 0
        print(addr + ': INBOX has ' + str(count) + ' email(s)')
        if count > 0:
            # Get latest email subject
            latest = msgs[0].split()[-1]
            status, data = mail.fetch(latest, '(RFC822)')
            msg = email.message_from_bytes(data[0][1])
            print('  Latest subject: ' + str(msg.get('Subject','')))
            print('  From: ' + str(msg.get('From','')))
        mail.logout()
    except Exception as e:
        print(addr + ': Error - ' + str(e))
