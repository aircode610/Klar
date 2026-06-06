# Klar

A mobile-first PWA that reads German official letters (Behördenbriefe) and turns
them into plain, calm, actionable clarity: a plain-language summary plus the
concrete **obligations** — each with its deadline, severity, risk score, the steps
to handle it, and the exact German sentence it came from.

This is the **Klar monorepo**. The frontend lives in [`frontend/`](frontend);
the AI pipeline in [`ai/`](ai); shared specs in [`docs/`](docs).

- Frontend spec: [docs/01-frontend.md](docs/01-frontend.md)
- As-built frontend reference: [docs/plans/2026-06-06-frontend.md](docs/plans/2026-06-06-frontend.md)
- **API contract (frontend ⇄ backend, the source of truth):** [docs/06-frontend-integration-contract.md](docs/06-frontend-integration-contract.md)

## Frontend

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Motion ·
Serwist (PWA) · Zustand. It talks to the FastAPI backend (cookie auth; routers at
`/letters`, `/actions`, `/rag`, `/auth`). **No mock data** — it runs against the
live backend.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000 (redirects to /letters → /login)
```

Environment (`frontend/.env.local`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # backend origin (no /api prefix)
NEXT_PUBLIC_DEFAULT_LANG=en                  # en | de | fa | tr | ar | uk
```

Scripts (run inside `frontend/`): `npm run dev` · `build` · `start` · `lint` ·
`typecheck`.

### Structure

```
frontend/
  app/            # routes: (app) screens, login/signup, scan, onboarding, offline
  components/     # ui primitives, brand devices, auth, screens, Providers
  lib/api/        # typed client (client.ts) — the single network seam
  lib/adapt.ts    # backend data -> display values
  lib/hooks.ts    # useLetter, useActions, useLetters (re-fetch on language change)
  lib/i18n/       # dictionaries + dir map (RTL for fa/ar)
  lib/store/      # zustand (auth session, lang, theme, letters cache)
  types/          # the backend contract (see docs/06)
  sw.ts           # Serwist service worker source
```

## Status

Frontend complete and integration-ready: all screens (auth, home, letter
detail/obligations, deadlines calendar, documents, me, onboarding, capture,
processing), the design system + brand devices, responsive layouts, PWA, i18n/RTL,
cookie auth, and the feature set (reply generator, reminders/calendar,
edit/why-risk, original/confidence/read-aloud) — all wired to the live backend
contract in `docs/06`. Verified: `typecheck`, `lint`, `build` clean (15 routes).
