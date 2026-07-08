# Mihan (مِهَن) — Claude Code Project Context

AI-powered alternative credit scoring for Saudi freelancers, embedded inside
Alinma Bank's app. Built for the AMAD 2026 hackathon (Alinma × Tuwaiq, July 16–18, Riyadh).
Scores income capacity from Open Banking cash-flow data because freelancers have
empty SIMAH files and no Mudad salary record.

**Status: feature-complete.** Backend (FastAPI, port 9000) and frontend
(Next.js 16 App Router, port 3000) are both done and demo-ready.

## Running

- Docker: `docker compose up --build` (both services)
- Windows native: `.\start.ps1`
- Manual: `cd backend && python -m uvicorn main:app --reload --port 9000` + `cd frontend && npm run dev`
- Tests: `cd backend && python -m pytest tests/` (69 cases: scoring, factor derivation, PII exclusion, statement import, import explanation/roadmap — must stay green)
- CI: `.github/workflows/ci.yml` runs tests + API smoke + docker build on push

## Key facts

- `backend/.env` (gitignored) holds real Wathq API credentials. Without it,
  everything falls back to simulation — demo still works but the live-proof
  button shows `"live": false`. See README Quick Start for the format.
- **Wathq is LIVE** (`backend/wathq_api.py` → api.wathq.sa sandbox). Lean,
  SIMAH, and Nafath are simulated (license-gated). All use try-real-then-fallback.
- The Trial-tier Wathq sandbox returns one fixed record with the company name
  masked with literal `x` chars for ANY CR — that's why the persona narrative
  uses simulated names while `/wathq-live-proof` shows the raw live response.
- Determinism matters on stage: simulated data seeds use `zlib.crc32`, never
  the built-in `hash()` (randomized per process → scores would change across restarts).
- Frontend API base is `NEXT_PUBLIC_API_URL` (default `http://localhost:9000`),
  defined once in `frontend/lib/config.ts`.
- **Factors are derived, not hardcoded**: `income_stability` (CV over zero-filled
  18-month window) and `client_diversity` (HHI) are computed live from transactions
  in `backend/factor_analysis.py` on every scoring call. Persona composites:
  mohammad 81.2 GREEN / noura 57.9 YELLOW / fahad 36.5 BUILDING.
- **AI payload is zero-PII by construction**: `backend/ai_privacy.py` is the single
  source of truth for what reaches Claude (five scores + tier, nothing else) —
  used by both `generate_cache.py` and `/ai-privacy-proof`. Never add profile
  fields to `build_ai_prompt`; `tests/test_ai_privacy.py` fails on any leak.
- **Real-statement importer** (the "your cash flow is simulated" answer):
  `backend/statement_pdf.py` (offline CLI) parses a real Saudi retail bank-statement
  PDF and anonymizes it AT ingestion — names/accounts/cards/refs stripped, senders
  pseudonymized, fail-closed `assert_no_pii` scan. `POST /import-statement` scores
  the anonymized JSON through the same VANC pipeline with **4 of 5 factors computed
  live** (stability CV, diversity HHI, expense ratio, savings) plus an integrity
  check against the statement's own printed totals. The consented anonymized
  statement for the demo lives in gitignored `team/real_statement_anonymized.json`
  (bring it to the venue like the `.env`); it scores BUILDING/no-loan — honest, and
  it demos the self-transfer / cash-deposit income-exclusion controls. Never commit
  raw statements or statement PDFs. The frontend screen is `/import` («جرّب ملفك»,
  entry card on `/demo`); the response includes an evidence-grounded roadmap
  (`improvement_roadmap.py` with `import_evidence`) and a bilingual explanation
  (`statement_explain.py`: template by default, `?live_ai=true` tries Claude with
  the same zero-PII payload — five scores + tier — and falls back on any failure).
- Public pitch materials live in `docs/pitch/`: deck outline, competitive
  landscape, unit economics, deck screenshots, and the backup videos
  (`mihan_demo_backup.webm` for the persona flow, `mihan_import_demo.webm`
  for the real-statement import flow).
- Backstage prep (demo script, day-of checklist, team cheat sheet, 72h plan)
  lives in the gitignored `team/` folder — kept out of the judged repo on
  purpose; it contains on-stage framing/Q&A coaching. Not pushed.

## Regulatory constraints (do not deviate)

- **DBR cap 45%** of total monthly income — SAMA Responsible Lending Art. 14(b).
  (33.33% applies only to employer payroll deduction — NOT here.)
- Repayment capacity = worst-month income basis (v1) or VANC μ−1.5σ (v2), never the average.
- Tiers: GREEN ≥75 (SAR 60K/24mo/8.2%), YELLOW ≥55 (SAR 25K/18mo/11.5%), BUILDING <55 (no loan).
- Weights: expense 30 / income-stability 25 / diversity 20 / savings 15 / contract-verification 10.
- Thin SIMAH + Mihan ≥75 → exception sandbox (auto-reject bypassed, routed to officer).
- The PDF is a "Cash Flow History Statement" — NEVER call it "Proof of Income"
  anywhere user-facing (legal liability distinction). Don't change the disclaimer in pdf_gen.py.
- Every scoring event goes to the SQLite audit log with endpoint + factor breakdown.
- No auto-approval — decisions always route through the officer dashboard.

## What NOT to do

- No pages/ directory — App Router only. Next.js 16 has breaking changes:
  read `frontend/node_modules/next/dist/docs/` before writing frontend code.
- No authentication — demo only.
- Don't hardcode Arabic text in JS — use the translations object (`frontend/lib/i18n.ts`).
- Don't show raw SIMAH score numbers (all personas return None).
- Personas (mohammad=GREEN, noura=YELLOW, fahad=BUILDING) are scripted — changing
  factor inputs or simulation data breaks the demo narrative and the tests.
