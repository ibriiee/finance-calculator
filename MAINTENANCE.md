# Mizan — Maintenance & Survival Guide

**Purpose:** keep Mizan running for the next 2–5 years **even with no developer / no Claude access.**
The code is hardened and frozen. The things that break an app over years are almost never the
code — they're the accounts and services under it. This file is your checklist for those.

> Rule of thumb: **if it still works, don't touch it.** Most "upgrades" are how apps break.

---

## 🔴 The one thing most likely to take the app down

**Supabase (your database) pauses on the free tier after ~7 days of no activity.**
When paused, the app loads but shows no data / errors on login.

- **Prevention:** just *use the app* every few days — that counts as activity. Or upgrade Supabase
  to the paid tier (~$25/mo) which never pauses.
- **If it happens:** log in to [supabase.com](https://supabase.com) → your project → click **Restore / Resume**.
  Takes a minute, no data lost.
- **Keep the account alive:** don't let the email on the Supabase account lapse. If you ever change
  email, update it there first.

---

## ✅ Your recurring checklist

| How often | Do this | Where |
|-----------|---------|-------|
| **Once — do it now** | Raise the database's "Max rows" API limit to **10000** (protects totals & backups as data grows over the years) | supabase.com → project → Settings → API → Max rows |
| Every few days | Open the app (keeps Supabase awake) | the app |
| Monthly | Export a data backup (JSON) | Settings → Data backup |
| When PKR/gold/silver move a lot | Refresh exchange & metal rates | Settings → Currencies |
| Yearly | Confirm Supabase + Vercel accounts still active & billing (if any) works | supabase.com / vercel.com |

**Backups are your safety net.** The monthly JSON export (Settings → Data backup) is a full copy of
your data. Keep the files somewhere safe (Google Drive, etc.). If the DB is ever lost, this restores it.

---

## 🟡 Accounts you must keep alive (nothing renews automatically)

1. **Supabase** — the database + login. Free tier is fine; paid avoids the pause above. This is critical.
2. **Vercel** — hosts the app at `fin9-ivory.vercel.app`. Free tier is fine. Keep the account active.
   The app auto-redeploys whenever code is pushed to the `main` branch on GitHub — no action needed from you.
3. **GitHub** — holds the code (`ibriiee/finance-calculator`). Keep the account; it's the source of truth.
4. **Domain** — `fin9-ivory.vercel.app` is a free Vercel subdomain and **never expires**. Only if you later
   add a custom domain (like `mizan.com`) will you have a yearly renewal to remember.

If you change the email/password on any of these, do it deliberately — losing access to Supabase or
Vercel is the hardest thing to recover.

---

## 🧪 Testing (if you ever need to modify the code)

Before deploying **any** code change, run:
```bash
npm test
```

All three tests must pass (sadaka math, life math, Hijri calendar). These are the verified core of the app — if they pass, the money calculations are correct.

---

## ⛔ Do NOT do these (they break a frozen app with no one to fix it)

- **Don't run `npm update` or `npm install <newer versions>`.** The dependencies (Next.js 16 etc.) are
  pinned and frozen via `package-lock.json`. Updating them can break the build with no developer to repair it.
- **Don't delete `package-lock.json`.** It's what keeps the build reproducible.
- **Don't rename or delete Supabase tables** from the dashboard. The app expects them exactly as they are.
- **Don't edit source files with tools that "fix" emoji/encoding** — it corrupts them. (Historical project rule.)

---

## 🟢 What's already handled in the code (so you don't have to worry)

- **Won't crash to a dead page** — every screen has error recovery ("Something went wrong → Try again").
- **Bad input can't corrupt your money data** — all amount fields reject empty/zero/negative values.
- **"Yours to keep" math is correct** — cash on hand is cumulative; advance sadaka nets against income properly.
- **Your data is private** — row-level security is on for all tables; only you and Abu Bakar see your own data.
- **Works offline-ish** — the service worker serves the last-loaded screens if you briefly lose signal,
  and always fetches fresh financial data when online (never shows stale money).

---

## 🆘 If something looks wrong

1. **Numbers look off:** pull to refresh / reopen the app. Check the "How is this calculated" breakdown on the dashboard.
2. **No data / stuck loading:** Supabase is probably paused — resume it (see top of this file).
3. **A page shows "Something went wrong":** tap **Try again**, or **Home**. Your data is safe; it's just that screen.
4. **App looks like an old version:** close it fully and reopen (the service worker fetches the latest when online).
5. **Rates look stale:** Settings → Currencies → refresh.

---

*Last hardened: 2026-07-01. Code is stable and complete — the app is designed to run untouched.
The only ongoing job is keeping the accounts above alive and taking monthly backups.*
