# Mihan frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + Framer Motion. This is
the phone-simulation demo UI described in the [project README](../README.md)
— start there for the full picture (routes, personas, scoring model).

## Local dev

```bash
npm install
npm run dev
```

Requires the backend running on `:9000` (see the root README's Quick Start).
API base URL is `NEXT_PUBLIC_API_URL`, defined in [`lib/config.ts`](lib/config.ts)
(defaults to `http://localhost:9000`; see `.env.production.example` for a
Docker/production override).

## Key paths

- [`app/page.tsx`](app/page.tsx) — `/` rejection simulator (the "before Mihan" wall)
- [`app/demo/`](app/demo) — `/demo` persona selector + full demo flow
- [`app/apply/`](app/apply), [`app/banker/`](app/banker) — applicant and officer-side screens
- [`lib/`](lib) — API client, types, i18n helpers, brand/tier config

See [`AGENTS.md`](AGENTS.md) before touching App Router code — this Next.js
version has breaking changes from what most training data assumes.
