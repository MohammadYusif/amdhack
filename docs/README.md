# مِهَن — Mihan

**AI-powered alternative credit scoring for Saudi freelancers, embedded inside Alinma Bank.**

Built for the **AMAD 2026 Hackathon** — Alinma Bank × Tuwaiq Academy, July 16–18, Riyadh.

---

## The Problem

1.674 million active Saudi freelancers are rejected by every commercial bank because:
- **SIMAH** file is empty (no credit history)
- **Mudad** has no salary record (no employer)

Standard rejection code: `NO_SALARY_TRANSFER`.

## The Solution

Mihan uses **Open Banking transaction data** (via Lean Technologies, SAMA-licensed March 26, 2026) to score income *capacity* instead of employment history. It is embedded directly into the Alinma Bank app — no separate product, no new account.

Tamara (Saudi BNPL) already proved the model: **32% better approval rates** for freelancers using Open Banking cash flow data. Mihan is the first to apply this inside a commercial bank term loan.

---

## Demo Flow

The demo runs as a mobile-first phone simulation in the browser. Walk through it in order:

### Screen 1 — Rejection Wall (`/`)
A realistic Alinma loan application form. The freelancer fills in their details and hits **`NO_SALARY_TRANSFER`** — the wall every freelancer currently hits. A pivot card appears offering the Mihan alternative path.

### Screen 2 — Profile Selector (`/demo`)
Choose one of three synthetic personas, each representing a real freelancer archetype:

| Persona | Profession | Expected Tier | Outcome |
|---|---|---|---|
| **محمد العتيبي** (Mohammad) | App Developer — 3 clients | 🟢 Green | SAR 60,000 / 24 mo / 8.2% APR |
| **نورا الشمري** (Noura) | Graphic Designer — 2 clients | 🟡 Yellow | SAR 25,000 / 18 mo / 11.5% APR |
| **فهد القحطاني** (Fahad) | Photographer — 1 client (shell co. risk) | 🔴 Building | No loan; improvement roadmap |

### Screen 3 — Onboarding (`/demo/[profileId]`)
Three-step onboarding sequence:
1. **Lean Open Banking consent** — the freelancer authorises cross-bank data access
2. **Nafath biometric auth** — face scan animation (Saudi national digital ID)
3. **Virtual Core Banking Profile** — Tech-IBAN provisioned

### Screen 4 — Live Pipeline Scan
Five real sequential API calls, each displayed as a step with a checkmark. The animation enforces a minimum 1.1 s per step so the progress is always visible:

| Step | What happens |
|---|---|
| 🪪 Step 1 — KYC | Nafath + Virtual Core Banking Profile created |
| 🏦 Step 2 — Lean AIS | 18 months of cross-bank transactions pulled; monthly buckets computed |
| 📋 Step 3 — SIMAH | Credit bureau queried; thin file detected (expected, not negative) |
| ✅ Step 4 — Wathiq | Client companies verified against Ministry of Commerce registry |
| ⚡ Step 5 — Mihan Engine | VANC scoring model runs; composite score + tier produced |

Open **DevTools → Network** during this screen to see all five `/pipeline/step*` calls in real time.

### Screen 5 — Score Result (Consumer View)
- **Score gauge** — animated composite score (0–100)
- **Tier badge** — Green / Yellow / Building with colour-coded offer
- **5-factor breakdown** — Expense Discipline (30%), Income Stability (25%), Client Diversity (20%), Savings Behavior (15%), Contract Verification (10%)
- **VANC vs Phase 1 toggle** — compare the two scoring model versions side by side
- **Loan offer** — amount, duration, APR, monthly installment
- **Buffer selection** — choose between Two-Month Escrow Holdback or SAMA Direct Debit Mandate before proceeding
- **PDF download** — Cash Flow History Statement (legally distinct from "Proof of Income")

### Screen 6 — Officer Dashboard (Bank View)
Full-page credit officer interface showing:
- Complete Mihan score with factor breakdown
- AI-generated Arabic explanation (Claude-powered)
- SIMAH exception sandbox banner (if triggered)
- Wathiq client verification results with risk flags
- Income trend chart (last 6 months, sourced from live Lean data)
- Loan recommendation panel
- Approve / Decline / Escalate / Human Review actions
- PDF download link

---

## Scoring Model

### Factors & Weights
| Factor | Weight | What it measures |
|---|---|---|
| Expense Discipline | 30% | Ratio of expenses to income; consistency of spending |
| Income Stability | 25% | Month-over-month income variance |
| Client Diversity | 20% | HHI concentration across income sources |
| Savings Behavior | 15% | Consistent positive end-of-month balance |
| Contract Verification | 10% | Wathiq-verified, active CRs for declared clients |

### Tiers
| Tier | Composite Score | Loan Offer |
|---|---|---|
| 🟢 Green | ≥ 75 | SAR 60,000 · 24 months · 8.2% APR |
| 🟡 Yellow | 55 – 74 | SAR 25,000 · 18 months · 11.5% APR |
| 🔴 Building | < 55 | No loan — improvement roadmap shown |

### DBR Cap
**45%** of total monthly income (SAMA Responsible Lending Principles, Article 14(b)).
The 33.33% cap applies only to employer salary deductions — not to freelancer income-based financing.

### SIMAH Exception Sandbox
All three demo personas have thin/empty SIMAH files (expected for freelancers). When Mihan Score ≥ 75 and SIMAH is thin, the auto-rejection is bypassed and the application is routed to a credit officer with the full Mihan decision package.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) · SQLite audit log · ReportLab PDF |
| Frontend | Next.js 14 App Router · Tailwind CSS · Framer Motion |
| Scoring | Custom VANC engine (Volatility-Adjusted Net Cash flow) |
| Open Banking | Lean Technologies AIS (simulated for demo) |
| KYC | Nafath (simulated biometric flow) |
| Company Verification | Wathiq — Ministry of Commerce (simulated) |
| Credit Bureau | SIMAH (simulated thin-file response) |
| AI Explanations | Claude (Anthropic) — Arabic + English |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- `pip install fastapi uvicorn reportlab pydantic`
- `cd mihan/frontend && npm install`

### Option A — One command (Windows PowerShell)
```powershell
.\start.ps1
```
This opens two PowerShell windows: one for the backend, one for the frontend.

### Option B — Manual (any OS)

**Terminal 1 — Backend**
```bash
cd backend
pip install fastapi uvicorn reportlab pydantic
python -m uvicorn main:app --reload --port 9000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

### URLs
| Service | URL |
|---|---|
| Demo app | http://localhost:3000 |
| Backend API | http://localhost:9000 |
| Interactive API docs | http://localhost:9000/docs |
| Health check | http://localhost:9000/health |
| SAMA Audit log | http://localhost:9000/audit-log |

---

## Environment Variables

### Frontend (`mihan/frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:9000
```

### Backend
```bash
# Optional — defaults shown
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ANTHROPIC_API_KEY=sk-ant-...   # Only needed to regenerate explanations.json
```
See `backend/.env.example` and `frontend/.env.production.example` for deployment templates.

---

## API Reference

Base URL: `http://localhost:9000`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Deployment health check |
| GET | `/profiles` | List all 3 demo personas |
| GET | `/profiles/{id}/score?version=v1\|v2` | Mihan score (Phase 1 or VANC) |
| GET | `/profiles/{id}/explanation?lang=ar\|en` | AI-generated explanation |
| GET | `/profiles/{id}/lean-transactions` | Simulated Lean AIS transaction history |
| GET | `/profiles/{id}/wathiq` | Wathiq client company verification |
| GET | `/profiles/{id}/simah` | SIMAH thin file report |
| GET | `/profiles/{id}/roadmap` | Score improvement plan |
| GET | `/profiles/{id}/pipeline/step1` | KYC — Nafath + Virtual Core Banking Profile |
| GET | `/profiles/{id}/pipeline/step2` | Lean AIS pull — returns `monthly_buckets` |
| GET | `/profiles/{id}/pipeline/step3` | SIMAH credit bureau check |
| GET | `/profiles/{id}/pipeline/step4` | Wathiq client verification |
| GET | `/profiles/{id}/pipeline/step5` | Mihan scoring engine |
| GET | `/profiles/{id}/full-assessment` | Complete pipeline snapshot |
| GET | `/profiles/{id}/proof-of-income` | Cash Flow History Statement (PDF) |
| POST | `/profiles/{id}/human-review` | Request credit officer review |
| POST | `/rejection-check` | Before-Mihan rejection simulation |
| GET | `/audit-log` | SAMA explainability audit trail |

---

## Regulatory Notes

- **SAMA Open Banking** — formally licensed March 26, 2026
- **DBR cap** — 45% of monthly income (Article 14(b), SAMA Responsible Lending Principles)
- **SAMA AI explainability** — every scoring event is logged to `audit_log` with full factor breakdown; human review always available
- **Cash Flow History Statement** — the PDF is deliberately named to avoid creating Alinma Bank liability ("Proof of Income" is legally distinct)
- **No auto-approval** — all loan decisions route through the credit officer dashboard

---

## Project Structure

```
/
├── backend/
│   ├── main.py                 # All API endpoints
│   ├── scoring.py              # 5-factor engine: Phase 1 + VANC
│   ├── models.py               # Pydantic request/response models
│   ├── profiles.py             # 3 synthetic personas
│   ├── database.py             # SQLite SAMA audit log
│   ├── pdf_gen.py              # Cash Flow History Statement PDF
│   ├── lean_simulation.py      # Deterministic Lean AIS transactions
│   ├── wathiq_simulation.py    # Wathiq company verification
│   ├── simah_simulation.py     # SIMAH thin file simulation
│   ├── improvement_roadmap.py  # Score improvement plan generator
│   ├── explanations.json       # Claude-generated Arabic/English explanations
│   └── generate_cache.py       # Script to regenerate explanations via Claude API
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # / — Rejection simulator
│   │   ├── demo/page.tsx       # /demo — Profile selector
│   │   ├── demo/[profileId]/   # /demo/[id] — Full demo flow
│   │   ├── apply/[profileId]/  # /apply — Alternative apply flow
│   │   ├── banker/             # /banker — Officer list + detail
│   │   └── mihan/              # /mihan — Hub page
│   ├── components/             # Shared UI components
│   └── lib/
│       ├── config.ts           # API URL, brand colors, tier config
│       ├── types.ts            # TypeScript interfaces
│       └── api.ts              # Typed fetch helpers
├── docs/
│   ├── README.md               # This file
│   └── CLAUDE.md               # Claude Code project context
└── start.ps1                   # Windows one-command startup
```
