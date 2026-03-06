# MacroManage - Preserve Human Connection

A smart event planning app that helps friends and family coordinate gatherings with ease.

## Features

- 📅 **Event Creation** with per-date time slots
- 📊 **Poll Mode** - Let friends vote on activity options
- 🔔 **Smart Reminders** - Multiple reminder times and push summaries
- 📈 **Activity Insights** - Track your social patterns and trends
- 🗺️ **Address Autocomplete** - 300+ real addresses across major US cities
- 📧 **Beautiful Email Invites** - Accept/Decline buttons with tracking

## Local Development

1. Install Python dependencies:
```bash
pip install python-dotenv
```

2. Create a `.env` file with your API keys:
```
MAILJET_API_KEY=your_mailjet_key
MAILJET_API_SECRET=your_mailjet_secret
RESEND_API_KEY=your_resend_key
SENDER_EMAIL=your_email@example.com
```

3. Run the server:
```bash
python3 server.py
```

4. Open http://localhost:3000 in your browser

## Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Add environment variables in Vercel dashboard:
   - Go to your project settings
   - Add `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `RESEND_API_KEY`, `SENDER_EMAIL`

5. Your app will be live at: `https://your-project.vercel.app`

## Tech Stack

- **Frontend:** Vanilla JavaScript, Tailwind CSS
- **Backend:** Python HTTP Server
- **Database:** SQLite
- **Email:** Mailjet (primary), Resend (fallback)
- **Deployment:** Vercel

## Team

Created by freshman students at Head-Royce School:
- Jason Zhang
- Jeffrey Cao
- Liam Ahn

**Mission:** "Preserve Human Connection"

We believe technology should bring people together, not pull them apart.
