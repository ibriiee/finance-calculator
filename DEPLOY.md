# Mizan — Deploy Guide (plain English)

This explains how the live app actually runs today, how to make a change and
get it live, and how to set it up again from zero if you ever need to. No
assumed dev experience — every step says exactly what to click or type.

> If you just want to **keep the app alive with no changes**, read
> [MAINTENANCE.md](MAINTENANCE.md) instead — it's shorter and non-technical.
> This file is for when you (or someone you ask for help) needs to touch code,
> run the database migrations, or set the project up somewhere new.

---

## 1. The three accounts that make this app exist

| Service | What it does | Where |
|---|---|---|
| **GitHub** | Stores the code | `github.com/ibriiee/finance-calculator` |
| **Vercel** | Hosts the live website | `fin9-ivory.vercel.app` |
| **Supabase** | The database (all financial data + login) | project ref `clfnismubljgmkjrxwxs` |

**How they connect:** Vercel watches the GitHub repo. Every time code is
pushed to the `main` branch, Vercel automatically rebuilds and redeploys the
live site — usually done in under 2 minutes. You do not need to click
"deploy" anywhere; pushing to `main` **is** the deploy.

---

## 2. Making a change and getting it live

1. Make your code change (locally, or by asking Claude Code to do it).
2. Run the test suite: `npm test` — all three lines must say ✓.
3. Run the build check: `npm run build` — must finish with no red errors.
4. Commit and push to `main`:
   ```bash
   git add -A
   git commit -m "describe what changed"
   git push origin main
   ```
5. Open `fin9-ivory.vercel.app` after ~2 minutes and check it looks right.

That's the entire deploy process. There is no separate "staging" or manual
deploy button — `main` is what's live.

---

## 3. If the change needs a database update (a `.sql` file)

Some changes add a new table or column and come with a `.sql` file in the
`supabase/` folder. Code pushes to GitHub do **not** run these automatically
— you have to run them yourself, once, in Supabase:

1. Go to [supabase.com](https://supabase.com) → log in → open the Mizan
   project.
2. Left sidebar → **SQL Editor** → **New query**.
3. Open the `.sql` file in question, copy everything inside it.
4. Paste into the SQL Editor and click **Run**.
5. If the file has a "PRE-FLIGHT" section with `SELECT` statements at the
   top, run those first — they should return 0 rows. If they return rows,
   stop and get help before continuing (it means some existing data needs
   fixing first).

Every `.sql` file in `supabase/` is safe to run more than once (it won't
duplicate anything) — so if you're not sure whether one already ran, running
it again does no harm.

**Two migrations are waiting to be run right now** (as of 2026-07-05):
`supabase/integrity-checks.sql` and `supabase/fix-payment-row-triggers.sql`.
See [PROJECT_STATUS.md](PROJECT_STATUS.md) for what they do.

---

## 4. Running the app on your own computer (optional, for testing changes)

You don't need this to use the app day-to-day — it's only for previewing a
code change before pushing it.

1. Install [Node.js](https://nodejs.org) (any version 18 or newer).
2. Get the code:
   ```bash
   git clone https://github.com/ibriiee/finance-calculator
   cd finance-calculator
   npm install
   ```
3. Get the secret keys: open `.env.local` on the machine that already has
   them (never commit this file — it's git-ignored on purpose), or fetch the
   3 values from Supabase → **Settings** → **API** (see below).
4. Run it:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in a browser. This talks to the **real**
   live database — there is no separate test database — so use Settings →
   **Test Mode** if you want to poke around without it looking like real data
   (it just adds a visible banner; it doesn't change what's real).

---

## 5. The secret keys (environment variables)

Three values connect the app to its database. They already exist in two
places — you should never need to create new ones unless rebuilding from
scratch (Section 6):

| Key | Where it comes from | Where it lives |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → "Project URL" | Vercel env vars + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → "anon public" key | Vercel env vars + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → "service_role" key | Vercel env vars + `.env.local` |

The `service_role` key bypasses all the security rules on the database — it
is what the app uses internally for a couple of specific server-only jobs
(the exchange-rate updater, backup scripts). **Never** put it in any file
that runs in the browser, and never share it outside these two places.

Two optional keys add live gold/silver prices (`GOLD_API_KEY` from
[goldapi.io](https://goldapi.io), free tier). Without them the app uses a
safe fallback price and still works correctly — see FIX-01 in
[PROJECT_STATUS.md](PROJECT_STATUS.md) for how the fallback is protected
from ever overwriting real data.

To view or change any of these on the live site: Vercel dashboard → the
project → **Settings** → **Environment Variables**.

---

## 6. Setting the whole thing up from zero (disaster scenario / new install)

This is the "everything is gone, start over" path. It's covered in full,
step by step, in [docs/DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md) —
that file also explains how to restore your actual data from a backup
instead of starting empty. In short:

1. New Supabase project → run `supabase/FRESH-INSTALL.sql` (this is every
   migration combined into one paste, in the right order).
2. Create the two user logins in Supabase → **Authentication** → **Users**.
3. New Vercel project → import the GitHub repo → paste in the 3 keys from
   Section 5 → Deploy.
4. If restoring old data: `npm run restore -- backups/your-backup-file.json`
   (see [docs/DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md)).

---

## 7. Keeping the database from going to sleep

Supabase's free tier pauses a project after about a week of no activity.
There's a small automation for this already in the repo
(`.github/workflows/keepalive.yml`) that pings the database twice a week —
it just needs to be switched on once:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. Add two secrets: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the same two
   values from Section 5, `anon` key only — never the service_role key here).
3. GitHub repo → **Actions** tab → find "supabase-keepalive" → **Run
   workflow** once manually to confirm it goes green.

If you'd rather not deal with this, just opening the app yourself every few
days also counts as activity and keeps it awake.

---

## 8. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Push to `main` but site looks unchanged | Vercel build failed | Vercel dashboard → **Deployments** → click the failed one → read the error |
| "Failed to fetch" on login | Supabase project paused or gone | [docs/DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md) Step 0 |
| A page shows a "couldn't load, try again" banner | Normal — the app is designed to show this instead of pretending data is empty (FIX-18). Usually a Supabase wake-up delay; click Try again | — |
| `npm run build` fails locally | A real code problem — read the error, it lists the exact file/line | Fix the error; don't skip the check |

---

*This file describes the deployment as it stands 2026-07-05. If the GitHub
repo, Vercel domain, or Supabase project ever change, update Section 1 first
— everything else stays accurate as long as those three facts are right.*
