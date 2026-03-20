from http.server import BaseHTTPRequestHandler
import json
import os
from urllib.parse import urlparse, parse_qs
import hashlib
import time
import urllib.request

# Load environment variables
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@macromanage.app')

# Simple in-memory database (in production, use a real database)
users_db = {}
user_data_db = {}

def hash_password(password):
    """Simple password hashing"""
    return hashlib.sha256(password.encode()).hexdigest()

def send_resend_email(to_email, subject, html_body):
    """Send email via Resend API - simplified working version"""
    debug_info = {
        "exists": bool(RESEND_API_KEY),
        "length": len(RESEND_API_KEY) if RESEND_API_KEY else 0,
        "starts_with_re": RESEND_API_KEY.startswith('re_') if RESEND_API_KEY else False,
        "first_10_chars": RESEND_API_KEY[:10] if RESEND_API_KEY else "NONE"
    }
    
    if not RESEND_API_KEY:
        return {"success": False, "error": "Email service not configured", "debug": debug_info}
    
    try:
        data = json.dumps({
            "from": SENDER_EMAIL,
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
            result = json.loads(response.read().decode())
            print(f"Email sent successfully to {to_email}")
            return {"success": True, "id": result.get("id")}
    except Exception as e:
        print(f"Email send failed: {str(e)}")
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
        
        if parsed.path == '/api/get-event':
            # Parse query params
            query = parse_qs(parsed.query)
            event_id = query.get('id', [None])[0]
            
            # For now, return mock event data - in production, fetch from database
            event_data = {
                "id": event_id,
                "title": "Event",
                "dateSlots": [
                    {"date": "2026-03-10", "start": "", "end": ""},
                    {"date": "2026-03-11", "start": "", "end": ""}
                ]
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(event_data).encode())
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
        
        if parsed.path == '/api/signup':
            email = data.get('email')
            password = data.get('password')
            name = data.get('name')
            
            if email in users_db:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Email already registered"}).encode())
                return
            
            users_db[email] = {
                'email': email,
                'password': hash_password(password),
                'name': name
            }
            user_data_db[email] = {'events': []}
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "user": {"email": email, "name": name}
            }).encode())
            return
        
        if parsed.path == '/api/login':
            email = data.get('email')
            password = data.get('password')
            
            if email not in users_db:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Email not found"}).encode())
                return
            
            user = users_db[email]
            if user['password'] != hash_password(password):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Incorrect password"}).encode())
                return
            
            user_data = user_data_db.get(email, {'events': []})
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "user": {"email": email, "name": user['name']},
                "events": user_data.get('events', [])
            }).encode())
            return
        
        if parsed.path == '/api/save-data':
            email = data.get('email')
            events = data.get('events', [])
            
            if email in user_data_db:
                user_data_db[email]['events'] = events
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())
            return
        
        if parsed.path == '/api/send-email':
            event = {
                'title': data.get('eventTitle'),
                'location': data.get('location', 'TBD'),
                'hostName': data.get('hostName', 'Someone')
            }
            # Use the actual Vercel domain from the request
            host = self.headers.get('Host', 'macromanage-git-main-jasonzhang072-2414s-projects.vercel.app')
            response_url = f"https://{host}/respond.html?event={data.get('eventId')}&email={data.get('to')}"
            html = generate_email_template(event, response_url)
            
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
        
        if parsed.path == '/api/notify-host':
            # Notify host when someone accepts/declines
            event_id = data.get('event_id')
            email = data.get('email')
            response_type = data.get('response')
            availability = data.get('availability', {})
            
            # Store response in localStorage (send back to frontend)
            response_data = {
                'event_id': event_id,
                'email': email,
                'response': response_type,
                'availability': availability
            }
            
            # Send email to host
            host_email = SENDER_EMAIL
            
            if response_type == 'accepted':
                avail_text = '<br>'.join([f"<strong>{date}</strong>: {times.get('start', 'Not specified')} - {times.get('end', 'Not specified')}" 
                                         for date, times in availability.items()])
                subject = f"✅ {email} accepted your invitation!"
                html_body = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0E4D0;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:24px;padding:40px;">
      <tr><td>
        <h1 style="color:#10B981;font-size:24px;margin:0 0 16px 0;">🎉 Great News!</h1>
        <p style="color:#3D2410;font-size:16px;margin:0 0 16px 0;"><strong>{email}</strong> accepted your invitation!</p>
        <div style="background:#FDF6E9;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-size:14px;color:#7D6245;font-weight:bold;margin-bottom:8px;">Their Availability:</div>
          <div style="font-size:14px;color:#5C3D1E;">{avail_text if avail_text else 'No specific times provided'}</div>
        </div>
        <p style="color:#7D6245;font-size:14px;margin:16px 0 0 0;">Check your MacroManage dashboard to see all responses!</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""
            else:
                subject = f"❌ {email} declined your invitation"
                html_body = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0E4D0;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:24px;padding:40px;">
      <tr><td>
        <h1 style="color:#EF4444;font-size:24px;margin:0 0 16px 0;">Update on Your Event</h1>
        <p style="color:#3D2410;font-size:16px;margin:0 0 16px 0;"><strong>{email}</strong> declined your invitation.</p>
        <p style="color:#7D6245;font-size:14px;margin:16px 0 0 0;">Check your MacroManage dashboard to see all responses!</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""
            
            result = send_resend_email(host_email, subject, html_body)
            
            # Return response data so frontend can store it
            result['response_data'] = response_data
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            return
        
        if parsed.path == '/api/send-confirmation':
            # Send confirmation email to attendees
            to_email = data.get('to')
            event_title = data.get('eventTitle')
            date = data.get('date')
            time = data.get('time')
            location = data.get('location', 'TBD')
            
            subject = f"✅ {event_title} is Confirmed!"
            html_body = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0E4D0;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:24px;padding:40px;">
      <tr><td>
        <h1 style="color:#10B981;font-size:28px;margin:0 0 16px 0;">🎉 Event Confirmed!</h1>
        <p style="color:#3D2410;font-size:16px;margin:0 0 24px 0;">Great news! <strong>{event_title}</strong> has been confirmed.</p>
        <div style="background:#FDF6E9;border-radius:16px;padding:24px;margin:24px 0;">
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:#9A7B5A;font-weight:bold;margin-bottom:4px;">📅 DATE</div>
            <div style="font-size:18px;color:#3D2410;font-weight:600;">{date}</div>
          </div>
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:#9A7B5A;font-weight:bold;margin-bottom:4px;">⏰ TIME</div>
            <div style="font-size:18px;color:#3D2410;font-weight:600;">{time}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#9A7B5A;font-weight:bold;margin-bottom:4px;">📍 LOCATION</div>
            <div style="font-size:18px;color:#3D2410;font-weight:600;">{location}</div>
          </div>
        </div>
        <p style="color:#7D6245;font-size:14px;margin:24px 0 0 0;text-align:center;">See you there! 🎊</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""
            
            result = send_resend_email(to_email, subject, html_body)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            return
        
        self.send_response(404)
        self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
