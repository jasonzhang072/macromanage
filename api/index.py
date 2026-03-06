from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
from urllib.parse import parse_qs, urlparse

# Environment variables from Vercel
MAILJET_API_KEY = os.environ.get('MAILJET_API_KEY', '')
MAILJET_SECRET_KEY = os.environ.get('MAILJET_API_SECRET', '')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'jasonzhang072@gmail.com')

def send_mailjet_email(to_email, subject, html_body):
    """Send email via Mailjet"""
    if not MAILJET_API_KEY or not MAILJET_SECRET_KEY:
        return {"success": False, "error": "Mailjet not configured"}
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
            return {"success": True, "provider": "mailjet"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def send_resend_email(to_email, subject, html_body):
    """Send email via Resend"""
    if not RESEND_API_KEY:
        return {"success": False, "error": "Resend not configured"}
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
            return {"success": True, "provider": "resend"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def generate_email_template(event, response_url):
    """Generate email HTML"""
    title = event.get('title', 'Event')
    location = event.get('location', 'TBD')
    host_name = event.get('hostName', 'Someone')
    
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>You're Invited</title></head>
<body style="margin:0;padding:0;background:#F0E4D0;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:24px;">
      <tr><td style="background:linear-gradient(135deg,#C4956A,#7D5A3C);padding:40px;text-align:center;">
        <h1 style="color:#FFFFFF;font-size:28px;margin:0;">You're Invited!</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">{host_name} wants to hang out</p>
      </td></tr>
      <tr><td style="padding:36px 40px;">
        <div style="background:#FDF6E9;border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
          <div style="font-size:24px;font-weight:bold;color:#3D2410;">{title}</div>
        </div>
        <div style="background:#FDF6E9;border-radius:12px;padding:14px;margin-bottom:24px;">
          <div style="font-size:12px;color:#9A7B5A;font-weight:bold;margin-bottom:4px;">LOCATION</div>
          <div style="font-size:16px;color:#5C3D1E;font-weight:600;">{location}</div>
        </div>
        <p style="text-align:center;color:#7D6245;margin-bottom:24px;">Let {host_name} know if you can make it.</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="47%" align="center">
              <a href="{response_url}&response=accept" style="display:block;background:#34D058;color:#FFFFFF;text-decoration:none;padding:16px;border-radius:50px;font-size:16px;font-weight:bold;">✓ Accept</a>
            </td>
            <td width="6%"></td>
            <td width="47%" align="center">
              <a href="{response_url}&response=decline" style="display:block;background:#F5EBD8;color:#7D5A3C;text-decoration:none;padding:16px;border-radius:50px;font-size:16px;font-weight:bold;border:2px solid #D4B896;">✗ Decline</a>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#FDF6E9;padding:20px;text-align:center;border-top:1px solid #EAD9C3;">
        <p style="margin:0;font-size:13px;color:#A88B6E;">Sent via <strong>MacroManage</strong> • Preserve Human Connection</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
            return
        
        self.send_response(404)
        self.end_headers()
    
    def do_POST(self):
        parsed = urlparse(self.path)
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(body) if body else {}
        except:
            data = {}
        
        if parsed.path == '/api/send-email':
            event = {
                'title': data.get('eventTitle'),
                'location': data.get('location', 'TBD'),
                'hostName': data.get('hostName', 'Someone')
            }
            response_url = f"https://macromanage.vercel.app/respond.html?event={data.get('eventId')}&email={data.get('to')}"
            html = generate_email_template(event, response_url)
            
            result = send_mailjet_email(data.get('to'), f"You're invited: {event['title']}", html)
            if not result['success']:
                result = send_resend_email(data.get('to'), f"You're invited: {event['title']}", html)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            return
        
        if parsed.path == '/api/update-response':
            # For now, just return success - we don't need to store responses in Vercel
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())
            return
        
        self.send_response(404)
        self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
