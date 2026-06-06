# Klar

A mobile-first PWA that reads German official letters (Behördenbriefe) and turns
them into plain, calm, actionable clarity — then produces the done-for-you reply
or form. See [CLAUDE.md](./CLAUDE.md) for the full product spec, brand system,
and API contract (the source of truth).

## Stack

- **Next.js 15** (App Router) + **React 19**, TypeScript strict
- **Tailwind CSS v4** with the Klar design tokens (paper/ink + electric lime)
- **Motion** (`motion/react`) for the brand animations
- **MSW** for the mock API (contract-accurate fixtures)
- **Serwist** for the PWA service worker
- **Zustand** for the small amount of global state (language, theme, session)

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
NEXT_PUBLIC_API_MODE=mock   # mock | live
NEXT_PUBLIC_API_BASE=       # backend base URL (without /v1) when live
NEXT_PUBLIC_DEFAULT_LANG=en # en | de | fa | tr | ar | uk
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
lib/i18n/       # dictionaries + dir map (RTL for fa/ar)
lib/store/      # zustand store
types/          # the API contract (mirrors CLAUDE.md Section 7)
sw.ts           # Serwist service worker source
```

## Build status

Phase 0 (foundation) complete: scaffold, tokens, fonts, dark mode, grain,
manifest + service worker, MSW with three fixture letters, and the app-shell
bottom nav. Screens are placeholders pending Phases 1–5 (see CLAUDE.md §9).
