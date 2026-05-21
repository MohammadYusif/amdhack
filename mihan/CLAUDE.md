# Mihan (مِهَن) — Claude Code Project Context

## What this project is

Mihan is an AI-powered alternative credit scoring engine for Saudi freelancers,
built as a feature embedded inside Alinma Bank's app. It is being built for the
AMAD 2026 hackathon (Alinma Bank × Tuwaiq Academy, July 16–18, Riyadh).

The core problem: 1.674M active Saudi freelancers are rejected by every commercial
bank because SIMAH is empty (no credit history) and they have no Mudad salary record.
Mihan uses Open Banking transaction data to score their income capacity instead.

## Current project structure

```
mihan/
├── backend/
│   ├── main.py           # FastAPI app — endpoints for scores, profiles, audit, PDF
│   ├── scoring.py        # Scoring engine — NEEDS UPDATES (see below)
│   ├── models.py         # Pydantic models — NEEDS UPDATES
│   ├── profiles.py       # 3 synthetic personas — NEEDS UPDATES
│   ├── database.py       # SQLite audit log — OK
│   ├── pdf_gen.py        # PDF generator — NEEDS RENAME + disclaimer update
│   ├── explanations.json # Arabic/English AI explanations — OK
│   └── generate_cache.py # Claude API script for Arabic explanations — OK
├── frontend/             # Next.js app (not yet provided — needs building)
├── start.ps1             # Windows startup script — OK
└── CLAUDE.md             # This file
```

## Regulatory context (critical — do not deviate from this)

### DBR cap
- 45% of total monthly income applies to Mihan (income-based, non-salary-deduction financing)
- 33.33% applies only to employer payroll salary deduction financing — NOT applicable here
- Source: SAMA Responsible Lending Principles, Article 14(b)

### Income formula (Phase 1)
- Baseline = worst_non_zero_month × 0.80
- Max installment = baseline × 0.45
- Zero-income months scored separately as volatility signal, NOT used in formula

### Income formula (Phase 2 — VANC, implement as separate function)
- underwriting_income = μ - (1.5 × σ) where μ = 12-month average, σ = std deviation
- Max installment = underwriting_income × 0.45

### Scoring factors and weights (v7.5 — 5 factors)
- expense_discipline: 30% (was 35% — updated)
- income_stability: 25% (was 30% — updated)
- client_diversity: 20% (unchanged)
- savings_behavior: 15% (unchanged)
- contract_verification: 10% (NEW — was missing entirely)

### Tiers
- GREEN: composite >= 75
- YELLOW: composite >= 55
- BUILDING: composite < 55

### SIMAH
- Always runs concurrently — mandatory under Saudi Credit Information Law
- Most target freelancers will have empty/thin SIMAH files — this is expected and correct
- Thin file + Mihan Score > 75 → route to human review (do NOT auto-reject)

### Cash Flow History Statement (previously "Digital Proof of Income")
- Name changed for legal reasons — "proof" creates liability for Alinma
- Must include disclaimer: historical data only, no creditworthiness assessment,
  100% of relying-party risk on the third party
- Must NOT contain credit score, SIMAH data, or any creditworthiness evaluation

### SAMA AI explainability requirement
- Every score must have an auditable factor breakdown
- Human review must be requestable at any time
- Audit log must capture all scoring events

## Synthetic personas (demo)

Three personas covering all three tiers:

**Mohammad Al-Ghamdi** (Green tier)
- App developer, 18 months history, 3 clients, SAR 9,500 worst month
- Strong expense discipline, good income stability, diversified clients

**Noura Al-Omari** (Yellow tier)
- Graphic designer, 12 months history, 2 clients, SAR 6,200 worst month
- Good expense discipline, income variability, client concentration risk

**Fahad Al-Qahtani** (Building tier)
- Photographer, 8 months history, 1 client, SAR 3,800 worst month
- Weak savings, single client dependency (71% of income), below SAR 7K floor

## Key architectural decisions

### What Mihan does NOT do
- Does NOT store consumer banking transaction data — scoring happens in-flight
- Does NOT issue credit reports or credit scores to third parties
- Does NOT replace SIMAH — always runs alongside it
- Does NOT enforce cross-bank deductions — Lean AIS is read-only

### What Mihan simulates in the demo
- Lean AIS data pull (synthetic transaction data per persona)
- SIMAH thin file (realistic — all personas have empty credit history)
- Wathiq company verification (declared-then-verified architecture)
- Nafath KYC + Virtual Core Banking Profile creation

### Standing deduction
- Only on Alinma business account (contractual, SAMA-confirmed legal with prior consent)
- Lean AIS provides early warning only — cannot enforce cross-bank deductions
- 60-day procurement lag buffer: escrow holdback or legacy account mandate

## API design principles

- All responses in both Arabic and English where applicable
- Audit log every scoring event (SAMA requirement)
- Human review endpoint always available
- Error responses in Arabic for consumer-facing endpoints

## Frontend tech stack (to be built)
- Next.js 14+ with App Router
- Arabic-first, RTL layout
- Alinma Bank color scheme: dark green #02141E, white, copper #CD907E
- Mobile-first (most Saudi users on mobile)
- shadcn/ui components where appropriate
- Tailwind CSS

## Backend tech stack
- FastAPI (Python)
- SQLite for audit log (demo) — PostgreSQL for production
- Uvicorn on port 9000
- Frontend on port 3000
