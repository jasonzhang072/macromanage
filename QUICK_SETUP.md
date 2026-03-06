# Quick Setup - Guaranteed Notifications

## Option 1: Email (FREE - Start Here)
Best free option. 100 emails/day free from Resend.

### Step 1: Get API Key
1. Go to https://resend.com
2. Sign up with your email
3. Verify your email address
4. Go to Dashboard → API Keys
5. Click "Create API Key"
6. Copy the key (starts with `re_`)

### Step 2: Add to .env
```
RESEND_API_KEY=re_your_actual_key_here
```

### Step 3: Test It
```bash
npm start
```
Create an event with your friend's email → They'll get a beautiful invitation email with Accept/Decline buttons.

---

## Option 2: SMS (Most Reliable - Costs Money)
Guarantees they see it. Costs ~$0.0075 per text.

### Step 1: Get Twilio Account
1. Go to https://twilio.com/try-twilio
2. Sign up (get $15.50 free credit)
3. Get a phone number ($1/month)
4. Copy Account SID, Auth Token, and phone number

### Step 2: Add to .env
```
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Which Should You Choose?

| Scenario | Best Option |
|----------|-------------|
| Testing / Development | Email (free) |
| Casual friend hangouts | Email |
| Important events (birthdays, weddings) | SMS |
| Critical business meetings | SMS + Email both |
| Budget conscious | Email only |
| Must guarantee they see it | SMS |

---

## The Code Now Does This Automatically:

When you create an event:
1. If friend has **phone** → Sends SMS (most reliable)
2. If friend has **email** → Sends Email (free)
3. Always creates **In-App** notification (fallback)

You'll see a toast message showing which notifications succeeded:
- "✓ All 3 friends notified successfully!"
- "⚠ 2/3 friends notified (some failed)"
- "✗ Notifications failed. Check your API keys."

---

## Need Help?

**Email not working?**
- Check Resend dashboard for errors
- Verify the email address isn't bouncing

**SMS not working?**
- Check Twilio console for errors
- Make sure you have a verified phone number
- Check your balance ($15.50 free to start)

---

## Get Your Resend API Key Now:
👉 https://resend.com
Takes 2 minutes. Then paste it in your `.env` file and start the server.
