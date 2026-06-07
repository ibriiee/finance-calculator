# Phase 0 — Initial Discovery Notes

**Date:** 2026-06-07
**Participants:** Ibrahim Naeem, Claude (AI Product Partner)
**Status:** Complete

---

## The Problem Statement

Ibrahim Naeem and his brother Abu Bakar are freelance professionals in Dubai's event industry,
originally from Pakistan. They face a unique combination of financial pain points that no
existing app addresses together:

### Pain Point 1 — Payment Lag (🔥🔥🔥 Critical)
- Projects range from 1-day gigs to 9-month contracts
- Payment arrives 15 days to 1.5 months AFTER the work is completed
- They need to track "earned" vs "actually received in bank" separately
- Cash flow planning is impossible without knowing what's coming and when

### Pain Point 2 — The WhatsApp Debt Chaos (🔥🔥🔥 Critical)
- Because of payment lag, they constantly front money for each other
- "Buy this for me → I'll buy that for you" creates a running IOU loop
- Manual tracking in WhatsApp chat — gets buried, lost, disputed
- No single source of truth for who owes whom right now

### Pain Point 3 — Sadaka Self-Tax (🔥🔥 High)
- Both brothers self-impose a compulsory ~20% charity deduction from EVERY inflow
- Applies to: project income, gifts, anything received
- Sometimes given in advance on income not yet received
- No structured tracking — just memory and goodwill
- Given in UAE (to relatives, needy) and Pakistan (family, gifts)

### Pain Point 4 — Shared / Split Costs (🔥🔥 High)
- Pakistan house expenses split monthly
- Shared purchases: car, parents' gifts
- Even shared charity (both earn Islamic reward)
- All manually calculated and verbally agreed

### Pain Point 5 — External Loans (🔥 Medium)
- Both brothers have loans owed to/from people outside their circle
- Joint loans (both responsible) and individual loans tracked separately
- No structured record

### Pain Point 6 — Zakat (🔥 Medium)
- Calculated manually once a year, error-prone
- Follows Hanafi school of thought
- Needs hawl (full lunar year) tracking

### Pain Point 7 — No financial goals system (🔥 Medium)
- Want to save for: 1-year emergency backup, a car, parents' house improvements
- Both individual and joint goals
- No shared tracking, no progress visibility

### Pain Point 8 — Digital will / Wasiyya (🌙 Lower priority but unique)
- No digital record of assets: bank accounts, crypto, digital assets
- No per-Islamic-rules beneficiary breakdown recorded anywhere

---

## User Profiles

### User 1 — Ibrahim Naeem
- Email: ibrahim_naeem@outlook.com
- GitHub: ibriiee
- Role: Brother 1, event industry freelancer, based in UAE Dubai
- Primary currencies: AED (work) + PKR (family/savings)

### User 2 — Abu Bakar
- Role: Brother 2, event industry freelancer, based in UAE Dubai
- Primary currencies: AED + PKR

### Key behavioral patterns:
- 80% mobile usage, 20% desktop
- Fast-paced industry — need quick logging, not long forms
- Both have high Islamic financial awareness
- Both practice advance Sadaka (giving before income received)

---

## Key Decisions Made in Discovery

| Decision | Choice | Reason |
|---|---|---|
| App type | Web app (mobile-first PWA) | 80% mobile, works on all devices without app store |
| Users | 2 fixed users | Fixed brothers, not a public product (yet) |
| Sadaka default % | 20% (each user can adjust) | Their practice; user-adjustable in Settings |
| Madhab | Hanafi (locked) | Their practice |
| Currency handling | AED + PKR + USD | Live FX rates fetched automatically |
| Loan repayment rule | Cash loans: return same face value; Commodity/Gold: return same quantity at today's price | Islamic Qard Hasan principles |
| Language | English (with Islamic terminology preserved: Sadaka, Zakat, Wasiyya) | English interface, Islamic terms respected |
| Offline | Yes — log offline, sync on reconnect | Events venues may have poor signal |
| Notifications | Both in-app and push, with admin panel on/off switch | User preference |
| 3rd person in ledger | External-only (no app access) — private record | Privacy requirement |
| Joint goals | Visible to both; individual goals visible only to owner | Privacy split |
| Wasiyya storage | In-app asset register + links to external docs | More private than Google Docs alone |

---

## What Was Ruled Out

- Streamlit — not suitable for mobile-first, modern-dark interactive app
- Firebase — unpredictable billing, NoSQL bad fit for relational debt logic
- No Urdu labels explicitly requested (English with Islamic terms)
- No 3rd user with app login (external person tracked passively only)
