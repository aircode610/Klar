# Klar

A mobile-first PWA that reads German official letters (Behördenbriefe) and turns
them into plain, calm, actionable clarity: a plain-language summary plus the
concrete **obligations** — each with its deadline, severity, risk score, the steps
to handle it, and the exact German sentence it came from.

- Frontend spec: [docs/01-frontend.md](docs/01-frontend.md)
- As-built frontend reference: [docs/plans/2026-06-06-frontend.md](docs/plans/2026-06-06-frontend.md)
- **API contract (frontend ⇄ backend, the source of truth):** [docs/06-frontend-integration-contract.md](docs/06-frontend-integration-contract.md)

## Stack

- **Next.js 15** (App Router) + **React 19**, TypeScript strict
- **Tailwind CSS v4** with the Klar design tokens (paper/ink + electric lime)
- **Motion** (`motion/react`) for the brand animations
- **MSW** for the mock API (contract-accurate fixtures)
- **Serwist** for the PWA service worker
- **Zustand** for the small amount of global state (language, theme, letters cache)

## Getting started

```bash
npm install
cp .env.example .env.local   # already present; defaults to mock mode
npm run dev
```

Open http://localhost:3000 — it redirects to `/letters`.

### Mock vs live

The app runs fully on fixtures via MSW. The backend swaps in by changing env
vars only — no frontend changes:

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # backend origin; routers at /letters,/actions,/rag (no /api, no auth)
NEXT_PUBLIC_API_MODE=mock                    # mock | live
NEXT_PUBLIC_DEFAULT_LANG=en                  # en | de | fa | tr | ar | uk
```

## Scripts

| Command             | Purpose                            |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Dev server                         |
| `npm run build`     | Production build (compiles the SW) |
| `npm run start`     | Serve the production build         |
| `npm run lint`      | ESLint                             |
| `npm run typecheck` | `tsc --noEmit`                     |

## Structure

```
app/            # routes: (app) screens, scan, onboarding, offline, manifest
components/     # ui primitives, brand devices, screens, Providers
lib/api/        # typed client (client.ts) + MSW mocks (mocks/)
lib/adapt.ts    # backend data -> display values
lib/hooks.ts    # useLetter, useActions, useLetters (re-fetch on language change)
lib/i18n/       # dictionaries + dir map (RTL for fa/ar)
lib/store/      # zustand store (lang, theme, letters cache)
types/          # the backend contract (see docs/06)
sw.ts           # Serwist service worker source
```

## Status

Complete: all screens (home, letter detail/obligations, deadlines calendar,
documents, me, onboarding, capture, processing), the design system + brand
devices, responsive desktop/mobile layouts, PWA, i18n/RTL, and the data layer
integrated to the implemented backend contract. Runs on mock data out of the box;
set `NEXT_PUBLIC_API_MODE=live` and point `NEXT_PUBLIC_API_URL` at the backend.
Verified: `typecheck`, `lint`, and `build` clean (13 routes).
