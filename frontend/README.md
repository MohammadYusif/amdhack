# Mihan frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + Framer Motion. This is
the phone-simulation demo UI described in the [project README](../README.md)
— start there for the full picture (routes, personas, scoring model).

## Running

Three ways, same as the root README's Quick Start:

```bash
# A — local dev (this folder)
npm install
npm run dev

# B — one command, both services (repo root, Windows)
..\start.ps1

# C — Docker, both services (repo root, no Node/Python needed)
docker compose up --build
```

Options B and C also start the backend. For option A, the backend must be
running on `:9000` separately (see the root README). The Docker image is a
multi-stage production build ([`Dockerfile`](Dockerfile) → `next build` →
standalone `next start`), so it serves the optimized bundle, not the dev server.

API base URL is `NEXT_PUBLIC_API_URL`, defined in [`lib/config.ts`](lib/config.ts)
(defaults to `http://localhost:9000`; see
[`.env.production.example`](.env.production.example) for a Docker/production
override — it's baked in at build time, so rebuild the image after changing it).

## Key paths

- [`app/page.tsx`](app/page.tsx) — `/` rejection simulator (the "before Mihan" wall)
- [`app/demo/`](app/demo) — `/demo` persona selector + full demo flow
- [`app/import/`](app/import) — `/import` **«جرّب ملفك»**: score a real, consented,
  pre-anonymized bank statement (JSON from `backend/statement_pdf.py`) through the
  same VANC engine — integrity badge, monthly cash-flow bars, income-exclusion
  callout, provenance-labeled factors, zero-PII AI explanation, improvement roadmap
- [`app/apply/`](app/apply), [`app/banker/`](app/banker) — applicant and officer-side screens
- [`lib/`](lib) — API client, types, i18n helpers, brand/tier config

See [`AGENTS.md`](AGENTS.md) before touching App Router code — this Next.js
version has breaking changes from what most training data assumes.
