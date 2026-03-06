# 🚀 Quick Deploy to Vercel - Follow These Steps

## Step 1: Get Your Code on GitHub (5 minutes)

### 1a. Create GitHub Account (if you don't have one)
- Go to [github.com/signup](https://github.com/signup)
- Sign up with your email: jasonzhang072@gmail.com
- Verify your email

### 1b. Create New Repository
1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `macromanage`
3. **Description:** `MacroManage - Preserve Human Connection`
4. Keep it **Public**
5. **IMPORTANT:** DO NOT check any boxes (no README, no .gitignore, no license)
6. Click **"Create repository"**

### 1c. Push Your Code
After creating the repo, GitHub will show you a page with commands. You'll see a URL like:
`https://github.com/YOUR_USERNAME/macromanage.git`

**Open Terminal and run these commands** (replace YOUR_USERNAME with your actual GitHub username):

```bash
cd /Users/jzhang/AppInter
git remote add origin https://github.com/YOUR_USERNAME/macromanage.git
git push -u origin main
```

If it asks for credentials:
- Username: your GitHub username
- Password: use a Personal Access Token (not your password)
  - Get token at: [github.com/settings/tokens](https://github.com/settings/tokens)
  - Click "Generate new token (classic)"
  - Give it a name like "MacroManage Deploy"
  - Check "repo" scope
  - Click "Generate token"
  - Copy the token and use it as your password

---

## Step 2: Deploy to Vercel (3 minutes)

### 2a. Sign Up for Vercel
1. Go to [vercel.com/signup](https://vercel.com/signup)
2. Click **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub account

### 2b. Import Your Project
1. Click **"Add New..."** → **"Project"**
2. Find your `macromanage` repository in the list
3. Click **"Import"**

### 2c. Configure Project
1. **Project Name:** `macromanage` (or whatever you want)
2. **Framework Preset:** Other
3. **Root Directory:** `./`
4. **Build Command:** (leave empty)
5. **Output Directory:** (leave empty)
6. Click **"Deploy"**

⏳ Wait 1-2 minutes for deployment to complete...

### 2d. Add Environment Variables (IMPORTANT!)
After deployment completes:

1. Go to your project dashboard
2. Click **"Settings"** tab
3. Click **"Environment Variables"** in the left sidebar
4. Add these variables one by one:

   **Variable 1:**
   - Name: `MAILJET_API_KEY`
   - Value: (your Mailjet API key from .env file)
   - Click "Add"

   **Variable 2:**
   - Name: `MAILJET_API_SECRET`
   - Value: (your Mailjet API secret from .env file)
   - Click "Add"

   **Variable 3:**
   - Name: `RESEND_API_KEY`
   - Value: (your Resend API key from .env file)
   - Click "Add"

   **Variable 4:**
   - Name: `SENDER_EMAIL`
   - Value: `jasonzhang072@gmail.com`
   - Click "Add"

5. After adding all variables, go to **"Deployments"** tab
6. Click the **"..."** menu on the latest deployment
7. Click **"Redeploy"**

---

## Step 3: Test Your Live App! 🎉

1. Vercel will give you a URL like: `https://macromanage.vercel.app`
2. Click the URL to open your live app
3. Test creating an event
4. Share the URL with friends!

---

## 🔑 Where to Find Your API Keys

Check your `.env` file at `/Users/jzhang/AppInter/.env` for:
- MAILJET_API_KEY
- MAILJET_API_SECRET
- RESEND_API_KEY

If you don't have these yet:

**Mailjet:**
1. Go to [mailjet.com](https://www.mailjet.com)
2. Sign up for free
3. Go to Account → API Keys
4. Copy your API Key and Secret Key

**Resend:**
1. Go to [resend.com](https://resend.com)
2. Sign up for free
3. Go to API Keys
4. Create new key and copy it

---

## ✅ You're Done!

Your app is now live and accessible worldwide! 🌍

**Next steps:**
- Share your Vercel URL with friends
- Test all features
- Monitor usage in Vercel dashboard
- Consider adding a custom domain (optional)

---

## 🆘 Need Help?

**If GitHub push fails:**
- Make sure you're using a Personal Access Token, not your password
- Check that the repository URL is correct

**If Vercel deployment fails:**
- Check the deployment logs in Vercel dashboard
- Verify all files are in the repository
- Make sure environment variables are set

**If emails don't send:**
- Verify API keys are correct in Vercel environment variables
- Check Function Logs in Vercel dashboard
- Make sure you redeployed after adding environment variables
