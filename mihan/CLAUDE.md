# Mihan (مِهَن) — Claude Code Project Context

## What this project is

Mihan is an AI-powered alternative credit scoring engine for Saudi freelancers,
built as a feature embedded inside Alinma Bank's app. It is being built for the
AMAD 2026 hackathon (Alinma Bank × Tuwaiq Academy, July 16–18, Riyadh).

The core problem: 1.674M active Saudi freelancers are rejected by every commercial
bank because SIMAH is empty and they have no Mudad salary record. Mihan uses
Open Banking transaction data (via Lean Technologies) to score income capacity instead.

Tamara (Saudi BNPL) already proved the concept: 32% better approval rates for
freelancers using Open Banking cash flow data. SAMA formally licensed Open Banking
on March 26, 2026. Mihan is the first to bring this into a commercial bank term loan.

---

## Current project structure

```
mihan/
├── backend/                          ← FastAPI — COMPLETE
│   ├── main.py                       # All endpoints — done
│   ├── scoring.py                    # 5-factor engine, Phase 1 + VANC — done
│   ├── models.py                     # Pydantic models — done
│   ├── profiles.py                   # 3 synthetic personas — done
│   ├── database.py                   # SQLite audit log with endpoint column — done
│   ├── pdf_gen.py                    # Cash Flow History Statement PDF — done
│   ├── lean_simulation.py            # Lean AIS synthetic transactions — done
│   ├── wathiq_simulation.py          # Wathiq company verification — done
│   ├── simah_simulation.py           # SIMAH thin file simulation — done
│   ├── improvement_roadmap.py        # Score improvement plan — done
│   ├── explanations.json             # Arabic/English AI explanations — done
│   ├── generate_cache.py             # Claude API script — done (contract_verification fixed)
│   └── fonts/                        # Arial TTF files for PDF — present
├── frontend/                         ← Next.js 16 App Router — COMPLETE
│   ├── app/
│   │   ├── layout.tsx                # RTL root layout, Alinma brand
│   │   ├── globals.css               # Alinma brand tokens + utility classes
│   │   ├── page.tsx                  # / → Rejection simulator + Mihan entry
│   │   └── demo/
│   │       ├── page.tsx              # /demo → Profile selector (3 personas)
│   │       └── [profileId]/
│   │           └── page.tsx          # /demo/[id] → Full demo flow (onboarding → scan → result → officer)
│   ├── components/
│   │   └── AlinmaHeader.tsx          # Shared bank header component
│   └── lib/
│       ├── config.ts                 # API URL + brand colors + tier config
│       ├── types.ts                  # TypeScript interfaces for all API responses
│       └── api.ts                    # Typed fetch helpers for all backend endpoints
├── start.ps1                         # Windows startup script — done
└── CLAUDE.md                         # This file
```

---

## Backend API — all available endpoints

Base URL: http://localhost:9000

| Method | Path | Purpose |
|--------|------|---------|
| GET | /profiles | List all 3 demo personas |
| GET | /profiles/{id}/score?version=v1\|v2 | Mihan score (v1=Phase1, v2=VANC) |
| GET | /profiles/{id}/explanation?lang=ar\|en | AI-generated explanation |
| GET | /profiles/{id}/lean-transactions | Simulated Lean AIS transaction history |
| GET | /profiles/{id}/wathiq | Wathiq client company verification |
| GET | /profiles/{id}/simah | SIMAH thin file report |
| GET | /profiles/{id}/roadmap | Score improvement plan |
| GET | /profiles/{id}/full-assessment | Complete pipeline (drives scoring animation) |
| GET | /profiles/{id}/proof-of-income | Cash Flow History Statement PDF download |
| POST | /profiles/{id}/human-review | Request credit officer review |
| POST | /rejection-check | Before-Mihan rejection simulation |
| GET | /audit-log | SAMA explainability audit trail |

---

## Regulatory context (critical — do not deviate from this)

### DBR cap
- **45%** of total monthly income — SAMA Responsible Lending Principles Article 14(b)
- Applies to income-based non-salary-deduction financing (freelancers)
- 33.33% applies ONLY to employer payroll salary deductions — NOT applicable here

### Scoring factors and weights (5 factors — current)
- expense_discipline: 30%
- income_stability: 25%
- client_diversity: 20%
- savings_behavior: 15%
- contract_verification: 10%

### Tiers
- GREEN: composite >= 75 → loan eligible, SAR 60K / 24mo / 8.2% APR
- YELLOW: composite >= 55 → restricted loan, SAR 25K / 18mo / 11.5% APR
- BUILDING: composite < 55 → no lending, show improvement roadmap

### Personas
- **mohammad** (Green): App developer, 3 clients, worst month SAR 9,500 → ~SAR 3,420 max installment
- **noura** (Yellow): Graphic designer, 2 clients, worst month SAR 6,200 → ~SAR 2,232 max installment
- **fahad** (Building): Photographer, 1 client (shell company risk flag), worst month SAR 3,800

### SIMAH
- All personas have thin/empty files — expected, not a negative signal
- Thin SIMAH + Mihan Score >= 75 → exception sandbox applies (auto-reject bypassed)

### Cash Flow History Statement (NOT "Proof of Income")
- Name matters legally — "proof" creates Alinma liability
- Contains NO credit score, NO SIMAH data, NO creditworthiness evaluation
- Full disclaimer already in pdf_gen.py — do not change wording

### SAMA AI explainability
- Every scoring event is logged to audit_log with endpoint, tier, factor breakdown
- Human review endpoint always available

---

## Frontend — routes

The frontend is built with Next.js 16 App Router, Tailwind CSS, Arabic-first RTL.

### Routes
- `/` → Rejection simulator (fake Alinma loan form → rejection screen → "ابدأ مع مِهَن" pivot)
- `/demo` → Profile selector — choose Mohammad / Noura / Fahad
- `/demo/[profileId]` → Full demo flow: onboarding consent → 5-step scan animation → score result → officer dashboard

### API base URL
`http://localhost:9000` — defined in `lib/config.ts`

---

## What NOT to do

- Do not use pages/ directory — App Router only
- Do not add authentication — demo only
- Do not hardcode Arabic text in JS — use a simple translations object
- Do not call the document "Proof of Income" anywhere in the frontend
- Do not show raw SIMAH score numbers (all profiles return None)
- Do not auto-approve loans — always route through the officer dashboard step
