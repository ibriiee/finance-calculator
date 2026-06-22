# Mizan — Disaster Recovery & Backup Runbook

What to do if login breaks, the Supabase project disappears, or you lose account
access — and how to make sure you never lose data when it happens.

> **Context:** On 2026-06-22 the original Supabase project became unreachable
> (account access lost → project gone, `iybcesqfjfxdxsybmyob` → NXDOMAIN). Login
> died with **"Failed to fetch."** We rebuilt on a new project but the old data
> was unrecoverable because there was no backup. This runbook prevents a repeat.

---

## 1. Prevention — do these once

### Don't lose account access (the thing that actually hurt)
- **Set a Supabase account password** (don't rely only on "Sign in with GitHub").
  Supabase Dashboard → Account → Authentication. Save it in your password manager.
- **Add the second brother's email as an Organization owner**
  (Dashboard → Organization → Team → Invite). Now access isn't a single point of
  failure — if one login is lost, the other can still restore/pause the project.
- **Record the project ref** somewhere safe (currently `clfnismubljgmkjrxwxs`).
  It's your proof of ownership if you ever need Supabase support.
- **Keep a private copy of `.env.local`** (it holds the URL + keys and is
  git-ignored, so it is NOT in the repo). Put it in your password manager.

### Keep the project alive (free tier)
- Free projects **pause after ~1 week of inactivity** and can eventually be
  removed. Just opening the app / dashboard occasionally keeps it active.
- If this becomes real money/data, the **Pro plan ($25/mo)** adds **daily
  automated backups + 7-day Point-in-Time Recovery** — at that point most of
  this runbook becomes a safety net rather than the primary plan.

---

## 2. Back up your data — do this regularly

You have **two** ways. The script is the real one; the in-app export is the
no-laptop fallback.

### A) Script (recommended — full DB, all users)
From the project folder:
```bash
npm run backup
```
Writes `backups/mizan-backup-<timestamp>.json` containing every table for **both**
users, with the profile id↔email map needed to restore later. The `backups/`
folder is git-ignored — **these files contain real financial data, keep them
private** (password manager / private cloud drive, not the repo).

**Cadence:** run it **before any risky change**, and otherwise weekly/monthly.
Keep the last few files.

> Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
> (already there).

### B) In-app export (no terminal needed)
Settings → **Data & Backup → Export all records to JSON**. Good for a quick
personal snapshot, but it's scoped to the logged-in user and is for your records
— the **script** is what `npm run restore` reads.

---

## 3. Recovery — when login is down

### Step 0 — Diagnose (1 minute)
Is it the backend or the app? Check whether the Supabase host resolves:
```bash
nslookup <your-ref>.supabase.co
```
- **NXDOMAIN / can't resolve** → project is gone or paused → backend problem
  (this is what happened). Go to Step 1.
- **Resolves fine** but login still fails → likely wrong env vars in Vercel, or a
  paused project showing a "paused" page → check the Supabase dashboard + Vercel
  env vars first.

### Step 1 — Get the project back
- **If paused:** Dashboard → Restore/Resume. Done — data intact.
- **If gone but you still have account access:** check for it under your org; open
  a Supabase support ticket with the project ref to attempt restore.
- **If account access is lost (the bad case):** rebuild fresh (Step 2). This is
  why backups + a second org owner matter.

### Step 2 — Rebuild a fresh project
1. Create a new Supabase project (note the new ref).
2. **SQL Editor → New query →** paste all of `supabase/FRESH-INSTALL.sql` → **Run**.
   (All 13 migrations, in order, idempotent.)
3. **Authentication → Users → Add user** (tick *Auto Confirm User*) for BOTH —
   emails must match exactly:
   - `ibrahim_naeem@outlook.com`
   - `bakarnaeem@hotmail.com`
4. **Authentication → URL Configuration:** Site URL + Redirect URL =
   `https://fin9-ivory.vercel.app` (so password-reset emails work).
5. **Project Settings → API:** copy Project URL, `anon` key, `service_role` key.

### Step 3 — Repoint the app
- Update **`.env.local`** (local dev): the 3 Supabase values.
- Update **Vercel → Settings → Environment Variables** (Production + Preview):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`.
- **Redeploy** in Vercel (env changes only apply on redeploy).
- Leave `NEXT_PUBLIC_SITE_URL` and `GOLD_API_KEY` alone — unrelated to Supabase.

### Step 4 — Restore your data (if you have a backup)
With `FRESH-INSTALL.sql` run and BOTH users created (Step 2):
```bash
npm run restore -- backups/mizan-backup-<timestamp>.json
```
This reads the new users' ids, remaps every old user-UUID by email, and upserts
all rows in FK-safe order (idempotent — safe to re-run). Then open the app and
sanity-check the numbers.

> **No backup?** Then it's a clean start — re-enter data. (That was the 2026-06-22
> outcome.) This is exactly the situation `npm run backup` exists to prevent.

---

## 4. Quick reference
| Situation | Action |
|-----------|--------|
| Routine safety | `npm run backup` (weekly + before risky changes) |
| "Failed to fetch" on login | `nslookup <ref>.supabase.co` → Step 1 |
| Project paused | Dashboard → Restore |
| Project gone, have backup | FRESH-INSTALL.sql → add users → repoint env → `npm run restore -- <file>` |
| Project gone, no backup | FRESH-INSTALL.sql → add users → repoint env → re-enter data |
| Avoid single point of failure | Add 2nd org owner + set account password |
