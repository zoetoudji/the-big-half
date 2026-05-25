# 🏃 The Big Half · Training Dashboard

Your personal half marathon training app. Hosted on Vercel, Strava-connected, free to run.

---

## What you need to set up (all free)

| Tool | What it's for | Link |
|------|--------------|-------|
| Node.js | Runs the project locally | https://nodejs.org → download LTS |
| Git | Version control, required by Vercel | https://git-scm.com/downloads |
| GitHub account | Hosts your code | https://github.com |
| Vercel account | Hosts your app (free) | https://vercel.com |
| Strava API app | OAuth for auto-completing runs | https://www.strava.com/settings/api |
| Anthropic API key | Powers the plan generation | https://console.anthropic.com/settings/keys |

---

## Step 1 — Install Node.js and Git

1. Go to **https://nodejs.org** → click the big green **LTS** button → install it
2. Go to **https://git-scm.com/downloads** → download for your OS → install it
3. To check it worked, open **Terminal** (Mac) or **Command Prompt** (Windows) and type:
   ```
   node -v
   git --version
   ```
   Both should print a version number.

---

## Step 2 — Create a GitHub account

1. Go to **https://github.com** → Sign up (free)
2. Once signed in, click the **+** icon top right → **New repository**
3. Name it: `the-big-half`
4. Set it to **Private** (your training data)
5. Leave everything else as default → click **Create repository**
6. Copy the repository URL (looks like `https://github.com/yourusername/the-big-half.git`)

---

## Step 3 — Push this project to GitHub

Open Terminal / Command Prompt, navigate to this project folder, then run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/the-big-half.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 4 — Get your Anthropic API key

1. Go to **https://console.anthropic.com/settings/keys**
2. Sign in (or create an account — you may already have one via Claude.ai)
3. Click **Create Key** → give it a name like `big-half-app`
4. Copy the key — it starts with `sk-ant-...`
5. Keep it somewhere safe (you'll add it to Vercel in Step 6)

---

## Step 5 — Set up your Strava developer app

1. Log into Strava → go to **https://www.strava.com/settings/api**
2. Fill in the form:
   - **Application Name**: `The Big Half`
   - **Category**: `Training`
   - **Club**: leave blank
   - **Website**: `https://the-big-half.vercel.app` (use your future Vercel URL)
   - **Authorization Callback Domain**: `the-big-half.vercel.app` (just the domain, no https://)
3. Upload any image for the app icon (required)
4. Click **Create** → you'll see your **Client ID** and **Client Secret**
5. Copy both — you'll need them in Step 6

> ⚠️ You'll update the callback domain after you know your actual Vercel URL in Step 6.

---

## Step 6 — Deploy to Vercel

1. Go to **https://vercel.com** → Sign up with your GitHub account
2. Click **Add New Project**
3. Find and select your `the-big-half` repository → click **Import**
4. Framework should auto-detect as **Vite** — if not, select it manually
5. Before clicking Deploy, click **Environment Variables** and add these one by one:

   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key from Step 4 |
   | `STRAVA_CLIENT_ID` | your Strava Client ID from Step 5 |
   | `STRAVA_CLIENT_SECRET` | your Strava Client Secret from Step 5 |
   | `VITE_STRAVA_CLIENT_ID` | same as STRAVA_CLIENT_ID |

6. Click **Deploy** — Vercel will build and deploy automatically
7. Once done, you'll get a URL like `the-big-half-xxx.vercel.app`

---

## Step 7 — Update your Strava callback URL

Now that you have your Vercel URL:

1. Go back to **https://www.strava.com/settings/api**
2. Update **Authorization Callback Domain** to your actual Vercel URL (e.g. `the-big-half-abc123.vercel.app`)
3. Save

---

## Step 8 — Open your app

Go to your Vercel URL. The app will:
1. Automatically generate your 15-week training plan (takes ~15 seconds)
2. Save it to your browser's localStorage
3. Be ready to use

Click **Connect Strava** in the footer, authorise the app, and your completed runs will auto-sync.

For calendar: click **Download calendar (.ics)** → open the file → it imports into Google Calendar, Apple Calendar or Outlook.

---

## Running locally (for development)

```bash
# Install dependencies
npm install

# Create your local env file
cp .env.example .env.local
# then fill in your keys in .env.local

# Start the dev server
npm run dev
```

Open **http://localhost:5173**

> Note: Strava OAuth won't work locally without a publicly accessible URL. You can test everything else locally and connect Strava on the deployed Vercel app.

---

## Making changes and redeploying

Every time you push to GitHub, Vercel automatically redeploys:

```bash
git add .
git commit -m "describe your change"
git push
```

That's it — your app updates in ~30 seconds.

---

## Costs

| Item | Cost |
|------|------|
| Vercel hosting | Free (Hobby plan) |
| Strava API | Free |
| GitHub | Free (private repo) |
| Anthropic API | ~£0.01–0.05 per plan generation, pennies/month |

---

## Architecture overview

```
Browser (React + Vite)
    │
    ├── /api/claude.js          ← Vercel serverless: proxies Anthropic API
    ├── /api/strava-auth.js     ← Vercel serverless: handles OAuth callback
    └── /api/strava-activities.js ← Vercel serverless: fetches your Strava runs
```

Your data (plan, completed sessions, quiz answers) lives in **localStorage** — it's private to your browser. No database needed for personal use.
