# Klar — Frontend Spec

**Owner: Dev 1 (Frontend)**
**Stack: Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · PWA**
**Deploy: Vercel**

> This document reflects the **frontend as built** and how it integrates with the
> **implemented backend** (`backend/` on `backend-dev`). The backend pivoted away
> from the earlier SSE / JWT / response-draft plan to an **obligation-centric**
> design (a Letter is extracted into structured ActionItems). This spec is
> reconciled to that real contract. See `02-backend.md` for the API.

---

## What the frontend is

A mobile-first, installable PWA. You photograph a German official letter; the
backend extracts it (Qwen-VL + structured tool call) into a summary plus a set of
**obligations** — each with a deadline, severity, server-computed risk score,
steps, and the exact German sentence it came from. The app presents that calmly,
tracks the deadlines on a calendar, and answers follow-up questions grounded in
the RAG legal corpus.

The design is editorial, paper-and-ink with one electric-lime accent, and ships
four brand devices: the **KLAR stamp**, the **highlighter sweep**, **fog-to-clear**,
and the **reimagined-officialdom** document styling.

---

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/letters` |
| `/letters` | Home — next-deadline banner, stat row, letters grouped into "Needs action" / "Handled" |
| `/letters/[id]` | **Letter detail (hero)** — clarity summary, obligations, evidence, RAG chat |
| `/deadlines` | iPhone-style calendar (month grid + day timeline) + agenda, from `/actions` |
| `/documents` | Searchable archive of letters |
| `/me` | Language, theme, profile vault, backend health, privacy |
| `/scan` | Capture — camera / file / sample |
| `/scan/processing` | Reading animation while the upload is extracted, then routes to the hero |
| `/onboarding` | Two short steps; picks language (sets RTL) |
| `/offline` | Service-worker navigation fallback |

Desktop renders a **left sidebar rail** with a wide content area; mobile keeps a
**bottom tab bar** (4 tabs + center lime scan FAB) and a slim top bar. Same
screens, two layouts.

---

## Architecture

```
app/
  (app)/letters, letters/[id], deadlines, documents, me   # main shell (sidebar + bottom nav)
  (onboarding)/onboarding
  scan, scan/processing, offline
  layout.tsx        # fonts, theme/dir init, grain overlay, Providers
  manifest.ts       # PWA manifest
components/
  ui/               # Button, Card, Chip, DeadlineChip, BottomSheet, SegmentedControl,
                    # Toast, EmptyState, Screen, BottomNav, ThemeToggle, LangSwitcher
  brand/            # Stamp, HighlightText, OriginalLetter, ReadingLoader, Wordmark
  screens/          # LetterCard, NextDeadlineBanner, calendar/Calendar,
                    # detail/ObligationCard, detail/LetterChat, me/ProfileVault
  app/              # Sidebar, MobileTopBar
  Providers.tsx     # boots MSW (mock) or registers the SW (live); syncs theme/dir
lib/
  api/              # typed client (client.ts) + MSW mocks (mocks/)
  adapt.ts          # backend data -> display values (deadlines, urgency, category icons)
  hooks.ts          # useLetter, useActions, useLetters
  store/            # zustand: lang, theme, onboarded, letters cache, pending upload
  i18n/             # dictionaries (en/de/fa…) + dir map (RTL for fa/ar)
  calendar.ts       # date helpers for the calendar
types/
  index.ts          # the backend contract (Letter, ActionItem, …)
  extra.ts          # frontend-only prototype types (ProfileField, CalendarEvent, ChatMessage)
sw.ts               # Serwist service worker
```

---

## Backend integration

All network access goes through `lib/api/client.ts`, reading
`NEXT_PUBLIC_API_URL` (no `/api` prefix, no auth). When
`NEXT_PUBLIC_API_MODE=mock`, **MSW** intercepts these exact requests and serves
contract-accurate fixtures. Switching to the real backend is one env change.

| What | Call | Notes |
|------|------|-------|
| Upload a letter | `POST /letters` (multipart `file`) | **Synchronous** — returns the fully extracted `Letter` (summary + actions) |
| Get a letter | `GET /letters/{id}` | Full letter with actions (incl. `status`) |
| Obligations feed | `GET /actions?status=` | Powers the calendar + deadlines agenda; drives the home feed |
| Update an obligation | `PATCH /actions/{id}` `{ status }` | "Mark done" → `done`; feeds the backend's correction log |
| Ask a follow-up | `POST /rag/search` `{ query, institution }` | The detail chat answers from retrieved § paragraphs |
| Backend health | `GET /health` | Shown on the Me screen |

Because the backend is obligation-centric and exposes **no "list letters"
endpoint**, the home/documents feed is built by reading `/actions`, collecting
the distinct `letter_id`s, and fetching each letter (cached in the store for
offline). Language is local and sent to the backend per request as `?lang=` (no
`/me` endpoint).

### Data shapes (mirrors `types/index.ts`)

```ts
type Severity = "critical" | "high" | "medium" | "low";
type ActionStatus = "open" | "done" | "ignored";
type DocumentCategory = "health_insurance" | "tax" | "immigration" | … | "other";

interface ActionItem {
  id: string; title: string; description?: string;
  deadline: string | null;        // YYYY-MM-DD
  severity: Severity; risk_score?: number;  // 0–100, computed server-side
  status?: ActionStatus; steps?: string[];
  evidence_span?: string;         // exact German source sentence
  reply_needed?: boolean;
}
interface Letter {
  id: string; institution: string; document_type: string;
  category: DocumentCategory; summary_en: string;
  actions: ActionItem[]; extraction_warnings: string[];
}
```

`lib/adapt.ts` turns this into display values: deadline → urgency colour +
countdown, `category` → icon + label, `severity` → label/colour, "handled" =
all actions done/ignored.

### How AI output surfaces in the UI

- **Summary (`summary_en`)** → the big Clash-set clarity statement.
- **Obligations (`actions`)** → `ObligationCard`s: severity chip, deadline chip,
  risk bar (0–100), a steps checklist, the **evidence span** quoted in mono, and
  "Mark done" (PATCH). The primary obligation gets the highlighter sweep.
- **`extraction_warnings`** → a soft amber note (e.g. "deadline may have passed").
- **RAG** → the per-letter chat calls `/rag/search` and answers with the cited
  § paragraph. This is the "ask a follow-up" differentiator, grounded in real law.

### Frontend-only (prototype, not backend-backed)

Clearly marked as such in `lib/data/prototype.ts`: the **profile vault** on the Me
screen, and a few **timed calendar appointments** that enrich the day timeline
alongside the real (date-only) obligation deadlines. These are candidates to
promote into the backend later.

---

## PWA

- `app/manifest.ts` — standalone, portrait, KLAR-stamp icons (SVG incl. maskable),
  theme colours per light/dark, `start_url: /letters`.
- `sw.ts` (Serwist) — precache app shell; **network-first** for `GET`s to
  `/letters`, `/actions`, `/rag`, `/health` (cached for offline); **cache-first**
  for fonts; **stale-while-revalidate** for images; navigation fallback to
  `/offline`. Registered in production/live; in mock mode the MSW worker runs
  instead (they never share scope).
- Capture and processing require a connection and say so calmly.

---

## Design system

- **Colour:** warm paper (`--bg`/`--surface`), warm ink, hairline `--line`,
  electric-lime `--brand` used sparingly (key fact, primary CTA, stamp). Urgency
  colours reserved for deadlines/severity. Dark mode via `data-theme`.
- **Type:** Clash Display (display), General Sans (UI/body), Space Mono (the
  paperwork texture: reference numbers, countdowns, labels, evidence spans).
- **Texture:** faint paper grain overlay; borders over shadows; one elevation
  token for floating elements.
- **Motion** (`motion/react`): page-load stagger, highlighter sweep, stamp
  "thunk", fog-to-clear. All gated behind `prefers-reduced-motion`.
- **i18n / RTL:** dictionary + `t()`; `dir` map sets `rtl` for Persian/Arabic;
  CSS logical properties throughout.

---

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # FastAPI backend (mounts /letters, /actions, /rag)
NEXT_PUBLIC_API_MODE=mock                    # mock | live
NEXT_PUBLIC_DEFAULT_LANG=en                  # en | de | fa | tr | ar | uk
```

In mock mode the app runs fully on MSW fixtures (seven seeded letters across
categories + a mocked extraction on upload), so the demo is always clickable and
the backend can be developed in parallel. Set `NEXT_PUBLIC_API_MODE=live` and run
the backend on `:8000` to switch — no frontend code changes.
