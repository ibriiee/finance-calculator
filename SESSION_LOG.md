# Session Log

2026-06-28
- Completed: Life Tracker v2 + v3. v2: Finance/Life rooms (sticky nav toggle), /life/settings, life_events (milestones/intentions/reminders), colored weeks grid + legend + Upcoming. v3: interactive cells (tap → week dates/age + event detail), 3 views (Events/Plain/Decades), you-are-here pulse, this-year row, Hijri today+age, event edit, clickable legend. Math weekIndexOf/nextOccurrence/weekStartDate/ageAtWeek/weekOfYear (self-check passes). Docs updated (PROJECT_STATUS modules/SQL/changelog/roadmap, SESSION_LOG).
- Changed files: BottomNav.tsx, ModuleHeader.tsx, life/page.tsx, life/settings/page.tsx, settings/page.tsx, lifeMath.ts(+test), database.types.ts, supabase/life-events.sql(+FRESH-INSTALL), PROJECT_STATUS.md, SESSION_LOG.md
- Blockers: migration 15 (life-events.sql) must be run in Supabase before events/Upcoming/editing work. Reminder PUSH deferred (prefer .ics calendar feed — free, no dep; see Roadmap).
- Next: (1) run migration 15. (2) Decide calendar sync route: .ics feed (recommended, free, phone calendar fires notifications) vs web-push (needs dep+cron). (3) Optional: deeper grid zoom (year/month/day), per-year view modes, MS To Do integration.

2026-06-28 (session 2)
- Completed: Life Tracker v4 + Sadaka smart linking. LIFE: new src/lib/hijri.ts (Hijri↔Gregorian via Intl Umm al-Qura, no dep, self-check ✓) → Islamic-dates overlay toggle (Ramadan/Eid Fitr/Eid Adha/New Year/Ashura) + new hijri_yearly recurrence so a Zakat date re-marks every lunar year across the lifespan; week-detail shows Hijri range + 7-day row; Decades legend; this-year card expands to a month-by-month calendar; Life-room bottom tab icons hidden. SETTINGS: all cards (Finance + Life) collapsible. SADAKA: new src/lib/sadaka.ts (per-income outstanding, self-check ✓) → income picker hides settled streams, shows "X due" per open stream, warns on overpay (excess→advance).
- Changed files: src/lib/hijri.ts (new), src/lib/sadaka.ts (new), lifeMath.ts, database.types.ts, life/page.tsx, life/settings/page.tsx, settings/page.tsx, components/sadaka/SadakaForm.tsx, BottomNav.tsx, PROJECT_STATUS.md, SESSION_LOG.md.
- Blockers: NONE new. No DB migration needed (recurrence is plain TEXT, accepts hijri_yearly; Islamic-dates toggle is localStorage mizan_islamic_dates). Migration 15 (life-events.sql) still required if not yet run.
- Next: optional deeper life-grid zoom (tap year/decade → day grid); true per-wife profile needs a relationships rework (for now wife's Zakat = a 2nd hijri_yearly event); .ics calendar feed still the recommended notification route.
