# Finance Calculator — Mizan (ميزان)

> A private financial operating system for two Muslim freelance brothers in the UAE event industry.
> Built with Islamic principles hardwired into the core, not bolted on as an afterthought.

---

## What Is This?

**Mizan** (Arabic: balance/scale) is a full-stack web app combining:
- Personal income & project tracking (earned vs. received — the payment lag problem)
- Sadaka self-tax tracker (compulsory voluntary charity from every inflow)
- Brother-to-brother ledger (the WhatsApp debt killer)
- Shared / split cost management
- External loans with Islamic Qard Hasan rules enforced
- Zakat calculator (Hanafi school)
- Financial goals (individual + joint)
- Wasiyya / Digital will vault

**Users:** Ibrahim Naeem & Abu Bakar (2 brothers, Dubai-based, Pakistani origin)
**Industry:** Events & Freelance (UAE + Pakistan)
**Currencies:** AED, PKR, USD

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React) |
| Styling | Tailwind CSS + shadcn/ui (dark theme) |
| Backend / Auth / DB | Supabase (Postgres + Row-Level Security) |
| Hosting | Vercel (free tier) |
| Live Prices | Gold-API + ExchangeRate-API |
| Version Control | GitHub |

---

## Project Structure

```
finance-calculator/
├── docs/
│   ├── phase-0-discovery/     # Initial research, discovery notes
│   ├── phase-1-prd/           # Product Requirements Document
│   ├── phase-2-architecture/  # Data model, DB schema, tech decisions
│   ├── phase-3-mvp/           # MVP build notes, component map
│   ├── decisions-log/         # All major decisions and why
│   └── research/              # Research notes from comparable projects
├── src/                       # Application source code (Next.js)
└── README.md
```

---

## Development Phases

| Phase | Description | Status |
|---|---|---|
| 0 | Discovery & Discussion | ✅ Complete |
| 1 | PRD & Wireframe Spec | ✅ Complete |
| 2 | Architecture & Data Model | 🔄 Up Next |
| 3 | MVP Build (Dashboard + Income + Brother Ledger) | ⏳ Pending |
| 4 | Sadaka + Shared Splits + External Loans | ⏳ Pending |
| 5 | Zakat Calculator + Financial Goals | ⏳ Pending |
| 6 | Wasiyya Vault + Polish | ⏳ Pending |
| 7 | Multi-family version (sellable product) | ⏳ Future |

---

## GitHub

**Repo:** `ibriiee/finance-calculator`
**Branch strategy:** `main` (stable) → `dev` (active development) → feature branches

---

*Built with intention. May Allah accept it as a means of barakah.*
