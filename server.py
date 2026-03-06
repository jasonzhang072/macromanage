#!/usr/bin/env python3
"""
MacroManage Backend Server (Python)
Handles email notifications via Mailjet (free), Resend, or SendGrid
"""
import http.server
import socketserver
import json
import sqlite3
import os
from urllib.parse import parse_qs, urlparse
from datetime import datetime
import ssl
import urllib.request

PORT = 3000

# Load .env file manually (no dotenv dependency needed)
def load_env():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'), 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())
    except Exception as e:
        print(f"Could not load .env file: {e}")

load_env()

MAILJET_API_KEY   = os.environ.get('MAILJET_API_KEY', '')
MAILJET_SECRET_KEY= os.environ.get('MAILJET_SECRET_KEY', '')
RESEND_API_KEY    = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL      = os.environ.get('SENDER_EMAIL', 'jasonzhang072@gmail.com')

print(f"  Mailjet:  {'✓ configured' if MAILJET_API_KEY and not MAILJET_API_KEY.startswith('xxx') else '✗ not set'}")
print(f"  Resend:   {'✓ configured' if RESEND_API_KEY and RESEND_API_KEY.startswith('re_') else '✗ not set'}")
print(f"  Sender:   {SENDER_EMAIL}")


def init_db():
    """Initialize SQLite database"""
    conn = sqlite3.connect('macromanage.db')
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT,
        dates TEXT,
        times TEXT,
        location TEXT,
        description TEXT,
        creator_email TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS event_friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT,
        contact TEXT,
        type TEXT,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT,
        user_email TEXT,
        voted_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_email)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT,
        email TEXT,
        response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, email)
    )''')
    
    conn.commit()
    conn.close()
    print("✓ Database initialized")

def send_mailjet_email(to_email, subject, html_body):
    """Send email via Mailjet - FREE 200 emails/day, no domain needed"""
    if not MAILJET_API_KEY or not MAILJET_SECRET_KEY or MAILJET_API_KEY.startswith('xxx'):
        return {"success": False, "error": "Mailjet API key not configured"}
    try:
        import base64
        data = json.dumps({
            "Messages": [{
                "From": {"Email": SENDER_EMAIL, "Name": "MacroManage"},
                "To": [{"Email": to_email}],
                "Subject": subject,
                "HTMLPart": html_body
            }]
        }).encode('utf-8')
        credentials = base64.b64encode(f"{MAILJET_API_KEY}:{MAILJET_SECRET_KEY}".encode()).decode()
        req = urllib.request.Request(
            "https://api.mailjet.com/v3.1/send",
            data=data,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"✓ Mailjet email sent to {to_email}")
            return {"success": True, "provider": "mailjet"}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"✗ Mailjet failed for {to_email}: HTTP {e.code} - {error_body}")
        return {"success": False, "error": f"HTTP {e.code}", "details": error_body, "provider": "mailjet"}
    except Exception as e:
        print(f"✗ Mailjet failed for {to_email}: {e}")
        return {"success": False, "error": str(e), "provider": "mailjet"}

def send_resend_email(to_email, subject, html_body):
    """Send email via Resend API"""
    if not RESEND_API_KEY or not RESEND_API_KEY.startswith('re_'):
        return {"success": False, "error": "Resend API key not configured"}
    try:
        data = json.dumps({
            "from": "onboarding@resend.dev",
            "to": [to_email],
            "subject": subject,
            "html": html_body
        }).encode('utf-8')
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"✓ Resend email sent to {to_email}: {result.get('id', 'sent')}")
            return {"success": True, "id": result.get('id'), "provider": "resend"}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"✗ Resend failed for {to_email}: HTTP {e.code} - {error_body}")
        return {"success": False, "error": f"HTTP {e.code}", "details": error_body, "provider": "resend"}
    except Exception as e:
        print(f"✗ Resend failed for {to_email}: {e}")
        return {"success": False, "error": str(e), "provider": "resend"}

def send_email(to_email, subject, html_body):
    """Try Mailjet first (free, no domain needed), then Resend as fallback"""
    result = send_mailjet_email(to_email, subject, html_body)
    if result["success"]:
        return result
    print(f"⚠ Mailjet not configured or failed, trying Resend...")
    result = send_resend_email(to_email, subject, html_body)
    if result["success"]:
        return result
    return {"success": False, "error": "No email provider configured. Add MAILJET_API_KEY to .env"}

def fmt_time(t):
    """Convert 24h time string to 12h format"""
    try:
        h, m = map(int, t.split(':'))
        suffix = 'AM' if h < 12 else 'PM'
        h = h % 12 or 12
        return f"{h}:{m:02d} {suffix}"
    except:
        return t

def generate_email_template(event, response_url):
    """Generate beautiful HTML email template"""
    title = event.get('title', 'Event')
    location = event.get('location', 'TBD')
    host_name = event.get('hostName', 'Someone')
    date_slots = event.get('dateSlots', [])

    # Build time slots HTML
    slots_rows = ''
    if date_slots:
        for slot in date_slots:
            try:
                from datetime import datetime as dt
                d = dt.strptime(slot['date'], '%Y-%m-%d')
                date_label = d.strftime('%A, %B %-d')
            except:
                date_label = slot.get('date', '')
            start = fmt_time(slot.get('start', ''))
            end = fmt_time(slot.get('end', ''))
            slots_rows += f"""
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #F0E4D0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:12px 16px;background:#FDF6E9;border-radius:12px;">
                      <div style="font-size:13px;color:#9A7B5A;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">{date_label}</div>
                      <div style="font-size:17px;color:#5C3D1E;font-weight:600;">{start} &ndash; {end}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>"""
    else:
        dates = event.get('dates', [])
        times = event.get('times', [])
        combined = zip(dates, times) if times else [(d, 'TBD') for d in dates]
        for d, t in combined:
            slots_rows += f"""
            <tr>
              <td style="padding:6px 0;">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td style="padding:12px 16px;background:#FDF6E9;border-radius:12px;">
                    <div style="font-size:15px;color:#5C3D1E;font-weight:600;">{d} &nbsp; {t}</div>
                  </td>
                </tr></table>
              </td>
            </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>You're Invited – {title}</title>
</head>
<body style="margin:0;padding:0;background:#F0E4D0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(92,61,30,0.18);">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#C4956A 0%,#7D5A3C 100%);padding:44px 40px 36px;text-align:center;">
          <div style="width:72px;height:72px;background:rgba(255,255,255,0.18);border-radius:50%;margin:0 auto 18px;line-height:72px;font-size:34px;">Event</div>
          <h1 style="margin:0 0 8px;color:#FFFFFF;font-size:28px;font-weight:800;letter-spacing:-0.5px;">You're Invited!</h1>
          <p style="margin:0;color:rgba(255,255,255,0.82);font-size:15px;">{host_name} wants to hang out with you</p>
        </td>
      </tr>

      <!-- WHITE BODY -->
      <tr>
        <td style="background:#FFFFFF;padding:36px 40px 0;">

          <!-- Event name pill -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="background:linear-gradient(135deg,#FDF6E9,#F5EBD8);border:2px solid #E8D5B7;border-radius:16px;padding:20px 24px;text-align:center;">
                <div style="font-size:12px;color:#9A7B5A;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Event</div>
                <div style="font-size:26px;font-weight:800;color:#3D2410;letter-spacing:-0.5px;">{title}</div>
              </td>
            </tr>
          </table>

          <!-- Date/Time slots -->
          <div style="font-size:12px;color:#9A7B5A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Available Times</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            {slots_rows}
          </table>

          <!-- Location -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="background:#FDF6E9;border-radius:12px;padding:14px 18px;">
                <div style="font-size:12px;color:#9A7B5A;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Location</div>
                <div style="font-size:16px;color:#5C3D1E;font-weight:600;">{location}</div>
              </td>
            </tr>
          </table>

          <!-- Message -->
          <p style="margin:0 0 28px;font-size:15px;color:#7D6245;line-height:1.7;text-align:center;">
            Let {host_name} know if you can make it.<br>
            <strong>Tap a button below to respond instantly.</strong>
          </p>
        </td>
      </tr>

      <!-- BUTTONS -->
      <tr>
        <td style="background:#FFFFFF;padding:0 40px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="47%" align="center">
                <a href="{response_url}&response=accept"
                   style="display:block;background:linear-gradient(135deg,#34D058,#1A9E3F);color:#FFFFFF;text-decoration:none;padding:16px 10px;border-radius:50px;font-size:16px;font-weight:800;text-align:center;box-shadow:0 6px 18px rgba(26,158,63,0.35);">
                  ✓&nbsp; Accept
                </a>
              </td>
              <td width="6%"></td>
              <td width="47%" align="center">
                <a href="{response_url}&response=decline"
                   style="display:block;background:#F5EBD8;color:#7D5A3C;text-decoration:none;padding:16px 10px;border-radius:50px;font-size:16px;font-weight:800;text-align:center;border:2px solid #D4B896;">
                  ✗&nbsp; Decline
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#FDF6E9;padding:20px 40px;text-align:center;border-top:1px solid #EAD9C3;">
          <p style="margin:0;font-size:13px;color:#A88B6E;">
            Sent via <strong style="color:#7D5A3C;">MacroManage</strong> &bull; Preserve Human Connection
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        # API Routes
        if path == '/api/health':
            self.send_json({"status": "ok", "email_configured": bool(MAILJET_API_KEY and not MAILJET_API_KEY.startswith('xxx'))})
            return
        
        # Serve static files
        if path == '/':
            path = '/index.html'
        
        file_path = path.lstrip('/')
        if os.path.exists(file_path):
            self.serve_file(file_path)
        else:
            self.send_error(404)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(body) if body else {}
        except:
            data = {}
        
        # Send Email
        if path == '/api/send-email':
            event = {
                'title': data.get('eventTitle'),
                'dateSlots': data.get('dateSlots', []),
                'dates': data.get('dates', []),
                'times': data.get('times', []),
                'location': data.get('location', 'TBD'),
                'hostName': data.get('hostName', 'Someone')
            }
            response_url = f"http://localhost:{PORT}/respond.html?event={data.get('eventId')}&email={data.get('to')}"
            html = generate_email_template(event, response_url)
            
            result = send_email(data.get('to'), f"You're invited: {event['title']}", html)
            self.send_json(result)
            return
        
        # Update Response
        if path == '/api/update-response':
            conn = sqlite3.connect('macromanage.db')
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO responses (event_id, email, response) VALUES (?, ?, ?)",
                     (data.get('event_id'), data.get('email'), data.get('response')))
            conn.commit()
            conn.close()
            self.send_json({"success": True})
            return
        
        self.send_error(404)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def serve_file(self, file_path):
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            ext = file_path.split('.')[-1].lower()
            content_types = {
                'html': 'text/html',
                'js': 'application/javascript',
                'css': 'text/css',
                'json': 'application/json',
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'svg': 'image/svg+xml'
            }
            
            self.send_response(200)
            self.send_header('Content-Type', content_types.get(ext, 'text/plain'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

def run():
    init_db()
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n╔════════════════════════════════════════════════════════╗")
        print(f"║         MacroManage Server Running                     ║")
        print(f"╠════════════════════════════════════════════════════════╣")
        print(f"║  URL: http://localhost:{PORT}                          ║")
        print(f"║  Email: {'✓ CONFIGURED' if MAILJET_API_KEY and not MAILJET_API_KEY.startswith('xxx') else '✗ NOT SET'}                      ║")
        print(f"╚════════════════════════════════════════════════════════╝\n")
        print("Press Ctrl+C to stop the server\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run()
