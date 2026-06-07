# Mizan — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (free tier)
- A Vercel account (free tier)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `mizan` | DB Password: (save this) | Region: pick nearest (UAE = Frankfurt/Singapore)
3. Wait for project to spin up (~2 min)

---

## Step 2: Run Schema

1. In Supabase Dashboard → **SQL Editor** → New Query
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and click **Run**
4. You should see all 14 tables created

---

## Step 3: Configure Auth

1. Go to **Authentication** → **Providers** → ensure Email is enabled
2. **Authentication** → **URL Configuration**:
   - Site URL: `https://your-vercel-app.vercel.app` (update after Vercel deploy)
   - Redirect URLs: add `https://your-vercel-app.vercel.app/**`
3. **Authentication** → **Settings** → disable "Confirm email" for private app (optional)

---

## Step 4: Get API Keys

In Supabase Dashboard → **Settings** → **API**:
- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

## Step 5: Create User Accounts

In Supabase Dashboard → **Authentication** → **Users** → **Add User**:
1. Add Ibrahim's account: email + password
2. Add Abu Bakar's account: email + password

The `profiles` table will auto-populate via trigger.

---

## Step 6: Enable Realtime

In Supabase Dashboard → **Database** → **Replication** → **Tables**:
Enable realtime for:
- `brother_ledger`
- `ledger_settlements`
- `shared_costs`
- `financial_goals`
- `goal_contributions`

---

## Step 7: Local Development

```bash
# 1. Clone the repo
git clone https://github.com/ibriiee/finance-calculator
cd finance-calculator

# 2. Install dependencies
npm install

# 3. Fill in environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# 4. Run development server
npm run dev
# Open http://localhost:3000
```

---

## Step 8: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub → select `ibriiee/finance-calculator`
3. Framework: **Next.js** (auto-detected)
4. Add **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   ```
5. Click **Deploy** — done in ~1 minute

---

## Step 9: Optional — Live Rates API

For live gold/silver prices, get a free key from:
- [goldapi.io](https://www.goldapi.io) (free tier, 100 req/day)
- [metals-api.com](https://metals-api.com) (free tier)

Add to Vercel env vars:
```
GOLDAPI_KEY=your_key_here
METALS_API_KEY=your_key_here
```

Without these, the app uses fallback static rates.

---

## App URLs

After deployment:
- **App**: `https://your-app.vercel.app`
- **Login**: `https://your-app.vercel.app/login`

Share the URL with Abu Bakar — he can log in with his account and start using the app.

---

## Private App Notes

This app is designed for exactly 2 users. The Brother Ledger, Shared Costs, and Joint Goals are visible to both accounts automatically. All other data (Income, Sadaka, Loans, Zakat, Wasiyya) is private per-user.
