# 🚀 MacroManage - Vercel Deployment Guide

## ✅ What's Already Done

Your project is **100% ready for Vercel deployment**! Here's what I've set up:

- ✅ Git repository initialized and committed
- ✅ `.gitignore` configured (excludes .env, database, etc.)
- ✅ `vercel.json` - Vercel configuration for Python backend
- ✅ `requirements.txt` - Python dependencies
- ✅ `.vercelignore` - Deployment exclusions
- ✅ `README.md` - Full project documentation
- ✅ All code files ready to deploy

## 🎯 Final Steps (You Need to Do These)

### Option 1: Deploy via Vercel Website (EASIEST - 5 minutes)

1. **Go to [vercel.com](https://vercel.com)**
   - Click "Sign Up" or "Login"
   - Use your GitHub, GitLab, or Bitbucket account (or email)

2. **Create a New Project**
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"

3. **Connect Your Repository**
   
   **Option A: Upload via GitHub (Recommended)**
   - Go to [github.com](https://github.com) and create a new repository
   - Name it: `macromanage` or `AppInter`
   - Run these commands in Terminal:
   ```bash
   cd /Users/jzhang/AppInter
   git remote add origin https://github.com/YOUR_USERNAME/macromanage.git
   git branch -M main
   git push -u origin main
   ```
   - Back in Vercel, import your GitHub repository

   **Option B: Direct Upload**
   - In Vercel, select "Continue with GitHub/GitLab/Bitbucket"
   - Or use Vercel CLI (see Option 2 below)

4. **Configure Project**
   - Vercel will auto-detect the configuration from `vercel.json`
   - Project Name: `macromanage` (or whatever you want)
   - Framework Preset: Other
   - Root Directory: `./`
   - Click "Deploy"

5. **Add Environment Variables** (IMPORTANT!)
   - After deployment, go to Project Settings → Environment Variables
   - Add these variables:
     ```
     MAILJET_API_KEY = your_mailjet_key_here
     MAILJET_API_SECRET = your_mailjet_secret_here
     RESEND_API_KEY = your_resend_key_here
     SENDER_EMAIL = jasonzhang072@gmail.com
     ```
   - Click "Save"
   - Redeploy the project (Deployments → click "..." → Redeploy)

6. **Done!** 🎉
   - Your app will be live at: `https://macromanage.vercel.app` (or similar)
   - Share this URL with friends!

---

### Option 2: Deploy via Vercel CLI (For Advanced Users)

1. **Install Node.js** (if not installed)
   - Download from [nodejs.org](https://nodejs.org)
   - Choose LTS version
   - Install and restart Terminal

2. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

3. **Login to Vercel**
   ```bash
   vercel login
   ```
   - Follow the prompts to authenticate

4. **Deploy**
   ```bash
   cd /Users/jzhang/AppInter
   vercel
   ```
   - Answer the prompts:
     - Set up and deploy? **Y**
     - Which scope? Choose your account
     - Link to existing project? **N**
     - Project name? **macromanage**
     - Directory? **./** (press Enter)
     - Override settings? **N**

5. **Add Environment Variables**
   ```bash
   vercel env add MAILJET_API_KEY
   vercel env add MAILJET_API_SECRET
   vercel env add RESEND_API_KEY
   vercel env add SENDER_EMAIL
   ```
   - Enter the values when prompted

6. **Deploy to Production**
   ```bash
   vercel --prod
   ```

7. **Done!** Your app is live!

---

## 📧 Getting API Keys (If You Don't Have Them)

### Mailjet (Free - Recommended)
1. Go to [mailjet.com](https://www.mailjet.com)
2. Sign up for free account
3. Go to Account Settings → API Keys
4. Copy your API Key and Secret Key

### Resend (Backup)
1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Go to API Keys
4. Create new API key and copy it

---

## 🔧 Troubleshooting

**Issue: Deployment fails**
- Check that all files are committed: `git status`
- Verify `vercel.json` syntax is correct
- Check Vercel deployment logs in dashboard

**Issue: App loads but emails don't send**
- Verify environment variables are set correctly
- Check that API keys are valid
- Look at Function Logs in Vercel dashboard

**Issue: Database not working**
- Vercel serverless functions are stateless
- SQLite won't persist between requests
- Consider using Vercel Postgres or another hosted database for production

---

## 📱 What Works After Deployment

✅ Event creation with dates and times
✅ Address autocomplete (300+ addresses)
✅ Poll mode for activity voting
✅ Smart reminders configuration
✅ Activity insights dashboard
✅ Email invitations (if API keys configured)
✅ Beautiful responsive UI

⚠️ **Note:** The SQLite database won't persist on Vercel's free tier. For production use, you'll need to:
- Use Vercel Postgres (free tier available)
- Use Supabase (free tier available)
- Or another hosted database solution

---

## 🎓 Next Steps After Deployment

1. Test your live app thoroughly
2. Share the URL with friends
3. Monitor usage in Vercel dashboard
4. Consider upgrading database for production use
5. Add custom domain (optional)

---

## 📞 Need Help?

- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- Vercel Support: [vercel.com/support](https://vercel.com/support)
- GitHub Issues: Create issues in your repository

---

**Your project is ready! Just follow Option 1 above to deploy in 5 minutes.** 🚀
