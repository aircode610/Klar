# Klar — Frontend ⇄ Backend Integration Contract

> ## ⚠️ UPDATE — the frontend now targets the `/api/*` + SSE backend
>
> The backend grew a rich `/api/*` surface; the frontend (`lib/api/client.ts`,
> `types/index.ts`) has been updated to it. The sections below describing the
> root-path synchronous flow are **superseded** by this. The backend's own
> `/openapi.json` is the authoritative schema; this is what the frontend uses:
>
> **Base:** `NEXT_PUBLIC_API_URL`, everything under **`/api`** (except `/health`).
> Auth is **cookie-based** (`credentials:"include"` on every request); a custom
> `ngrok-skip-browser-warning` header is sent (harmless off-ngrok).
>
> **Endpoints:**
> - `POST /api/auth/signup|login` → `{ user }` (+ Set-Cookie) · `POST /api/auth/logout` · `GET /api/auth/me`
> - `POST /api/letters/upload` (multipart `file`) → `{ letter_id }` (returns immediately)
> - **`GET /api/letters/{id}/process?lang=` → SSE** (`text/event-stream`) — the pipeline
> - `GET /api/letters/{id}` → full Letter · `GET /api/letters?status=&category=` → `LetterListItem[]`
> - `GET /api/deadlines` → `DeadlineItem[]` · `GET /api/actions` · `PATCH /api/actions/{id}` · `POST /api/rag/search`
>
> **SSE event sequence** (`event: <type>` / `data: <json>`):
> `ocr_result {text}` → `classification {type,category,agency}` → `risk_score {score,label}`
> → `deadline {date,days_remaining}` → `consequence {text}` → `explanation {chunk}`×N
> → `response_draft {chunk}`×N (German, only if a reply is needed) → `checklist {items}`
> → `citations {items:[{section,text,score}]}` → `done {letter_id}` | `error {code,message}`.
> The frontend consumes it via `fetch` + `ReadableStream` (so the cookie **and** the
> ngrok header travel), renders it live in the processing screen, then opens
> `GET /api/letters/{id}`. `Letter` now carries `summary`, letter-level `risk_score`,
> `explanation`, `response_draft`, `checklist`, `citations`, `consequence`, `status`.
>
> **🔴 Two backend blockers to fix for end-to-end (frontend is correct):**
> 1. **Session rejected** — `POST /api/auth/login` sets `klar_session`, but
>    `GET /api/auth/me` (and all `/api` routes) return `401 AUTH_SESSION_EXPIRED`
>    with that exact cookie **server-side (curl)**. The freshly-issued session
>    isn't validating — check session persistence / `expires_at` / worker-DB
>    isolation.
> 2. **Cookie `SameSite=lax`** — the frontend (localhost:3000) and backend (ngrok)
>    are **cross-site**, so the browser won't send a `Lax` cookie on fetch. Set
>    **`SameSite=None; Secure`** (`cookie_samesite="none"`, `cookie_secure=True`).
>    CORS is already correct (`allow-origin: http://localhost:3000`, credentials).

**The complete, copy-pasteable contract between the Next.js frontend and the
FastAPI backend + AI pipeline. Build to this and the two halves snap together.**

This is derived directly from the frontend's `lib/api/client.ts` and
`types/index.ts` — it is the **source of truth** for what crosses the wire. It
covers **both directions**: what the frontend sends you, and what you must send
back. Match the JSON field-for-field and integration needs **zero frontend
changes** — flip `NEXT_PUBLIC_API_MODE=live`, set `NEXT_PUBLIC_API_URL`, done.

> You do **not** need to change your internal structure. Your DB models, services,
> and prompts are yours. Only the **JSON on the wire** must match what's below.

---

## 0. TL;DR for a coding agent

You must expose exactly these six HTTP endpoints at the **root** of your API
(no `/api` prefix), with **no authentication**:

| # | Method | Path | Frontend sends | Frontend expects back |
|---|--------|------|----------------|-----------------------|
| 1 | `POST` | `/letters?lang=<code>` | multipart `file` | `Letter` (full extraction, synchronous) |
| 2 | `GET` | `/letters/{id}?lang=<code>` | — | `Letter` |
| 3 | `GET` | `/actions?lang=<code>&status=<status>` | — | `ActionListItem[]` |
| 4 | `PATCH` | `/actions/{id}` | `{ status?, deadline?, title?, description? }` | `{ id, status }` |
| 5 | `POST` | `/rag/search` | `{ query, top_k?, institution? }` | `{ hits: RagHit[] }` |
| 6 | `GET` | `/health` | — | `{ status, service, model }` |
| 7 | `POST` | `/auth/signup` | `{ email, password }` | `{ user }` + **Set-Cookie** |
| 8 | `POST` | `/auth/login` | `{ email, password }` | `{ user }` + **Set-Cookie** |
| 9 | `POST` | `/auth/logout` | — | `204` + clears cookie |
| 10 | `POST` | `/letters/{id}/reply?lang=<code>` | `{ action_id?, applicant? }` | `ReplyDraft` (German reply) |

**Auth (cookie-based):** login/signup set an **httpOnly session cookie** via
`Set-Cookie`; the body returns only `{ user }` (no token in JS). The frontend
sends every request with `credentials: "include"`, so the cookie rides along —
scope letters/actions to the user behind it. A `401` makes the frontend sign out
and return to `/login`. See §A. (SSE, payments, citations endpoints,
citations endpoints, and a list-all-letters endpoint remain **not required** — §9.)

---

## 1. Environments

| | Frontend | Backend |
|--|----------|---------|
| **Local** | `http://localhost:3000` | `http://localhost:8000` |
| **Production** | `https://<your-app>.vercel.app` | `https://<your-api-host>` (Railway/Render) |

Frontend env (`.env.local` / Vercel dashboard):

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # your backend origin, no trailing slash, no /api
NEXT_PUBLIC_API_MODE=live                    # "live" hits your backend; "mock" uses MSW fixtures
NEXT_PUBLIC_DEFAULT_LANG=en
```

**CORS (backend must set this):** allow the frontend origin(s), the methods
`GET, POST, PATCH, OPTIONS`, and the `Content-Type` header.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://<your-app>.vercel.app"],
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_credentials=True,        # REQUIRED for the cookie; origins must NOT be "*"
    allow_headers=["Content-Type"],
)
# Session cookie: HttpOnly; SameSite=None; Secure   (cross-site frontend↔backend in prod)
```

---

## 2. Conventions

- **Auth via httpOnly cookie.** `/auth/login` and `/auth/signup` set a session
  cookie (`Set-Cookie`, `HttpOnly`); the frontend sends every request with
  `credentials: "include"`. No `Authorization` header, no token in JS. See §A.
  (The frontend also supports a local **guest** session for the demo that never
  calls the backend — guest requests simply arrive without a cookie.)
- **Routers at root.** `/letters`, `/actions`, `/rag`, `/health`, `/auth/*`.
  **No `/api` prefix.**
- **Content types.** Requests with a body are `application/json`, except
  `POST /letters` which is `multipart/form-data`. Responses are `application/json`.
- **IDs** are opaque strings. UUIDs are fine. The frontend never parses them.
- **Dates** (`deadline`) are **date-only** strings `"YYYY-MM-DD"`, or `null`.
- **Money / reference numbers** live inside the human text fields — there are no
  separate numeric money fields. Never invent values; omit/null instead.
- **Errors:** use correct HTTP status codes. The frontend reads FastAPI's default
  `{"detail": "..."}` for the message (when `detail` is a string). Any non-2xx
  becomes an error state in the UI.
- **Language:** `?lang=<code>` on content endpoints; `<code> ∈ en|de|fa|tr|ar|uk`.
  See §7.

---

## 3. The data model (exact TypeScript — mirror this)

This is the verbatim contract from `types/index.ts`. Your JSON must
deserialize into these shapes.

```ts
type Severity        = "critical" | "high" | "medium" | "low";
type ActionStatus    = "open" | "done" | "ignored";
type DeadlineSource  = "explicit" | "inferred" | "unknown"; // optional, informational
type DocumentCategory =
  | "health_insurance" | "other_insurance" | "banking" | "tax" | "immigration"
  | "education" | "housing" | "utilities" | "employment" | "government_benefits"
  | "pension" | "broadcast_fee" | "civic" | "legal_debt" | "other";

interface RiskBreakdown {        // the factors behind risk_score (RiskScore table)
  score: number;                 // 0–100 (== risk_score)
  deadline_proximity_pts: number;  // 0..1
  institution_weight: number;      // 0..1
  severity_pts: number;            // 0..1
  missing_info_penalty: number;    // 0..1
  explanation: string;
}

interface ActionItem {
  id: string;
  title: string;                 // localized
  description?: string;          // localized
  deadline: string | null;       // "YYYY-MM-DD" | null
  severity: Severity;
  risk_score?: number;           // 0–100 integer
  risk?: RiskBreakdown;          // NEW — powers the "why this risk" view
  deadline_confidence?: number;  // NEW — 0..1
  deadline_source?: "explicit" | "inferred" | "unknown";  // NEW
  status?: ActionStatus;
  steps?: string[];              // localized
  evidence_span?: string;        // exact German source sentence (NOT localized)
  reply_needed?: boolean;
}

interface Letter {
  id: string;
  institution: string;           // German, NOT localized
  document_type: string;         // German, NOT localized
  category: DocumentCategory;
  summary_en: string;            // localized (despite the _en name)
  actions: ActionItem[];
  extraction_warnings: string[]; // localized
  ocr_text?: string | null;      // NEW — extracted German source (fog-to-clear view), NOT localized
  confidence?: number | null;    // NEW — 0..1 overall; <0.85 shows a "get a human" prompt
}

interface ActionListItem {       // GET /actions row
  id: string;
  letter_id: string;
  title: string;                 // localized
  deadline: string | null;
  severity: Severity;
  status: ActionStatus;
  reply_needed: boolean;
}

interface RagHit { text: string; score: number; metadata: Record<string, unknown>; }

interface ReplyDraft {           // POST /letters/{id}/reply
  body_text: string;             // ready-to-send Behördendeutsch (German)
  language: string;              // "de"
  download_url?: string | null;  // optional server-rendered PDF
}
```

> The new fields are **additive and optional** — the app degrades gracefully if
> they're absent (no risk breakdown, no original-text view, no low-confidence
> prompt). But including `risk`, `ocr_text`, `confidence`, and `deadline_confidence`
> lights up the trust features.

### Reference Pydantic models (illustrative — your internals are yours)

```python
class ActionOut(BaseModel):
    id: str
    title: str
    description: str | None = None
    deadline: str | None = None          # "YYYY-MM-DD"
    severity: Literal["critical","high","medium","low"]
    risk_score: int | None = None        # 0..100
    status: Literal["open","done","ignored"] | None = None
    steps: list[str] = []
    evidence_span: str | None = None
    reply_needed: bool = False

class LetterOut(BaseModel):
    id: str
    institution: str
    document_type: str
    category: str                        # one of DocumentCategory
    summary_en: str
    actions: list[ActionOut] = []
    extraction_warnings: list[str] = []
```

### Enum meanings

```
Severity (per action):
  critical  threatens legal status / hard legal consequence
  high      serious financial/legal consequence
  medium    clear deadline, moderate consequence
  low       informational or flexible

ActionStatus: open (to do) | done (completed) | ignored (user dismissed)

DocumentCategory: classify into exactly one. Drives the UI icon + label:
  health_insurance other_insurance banking tax immigration education housing
  utilities employment government_benefits pension broadcast_fee civic legal_debt other
```

Send enum values **exactly** (lowercase, snake_case). Unknown `category` → generic
icon; unknown `severity` → treated as `medium`; missing `status` → `open`.

---

## A. Auth (cookie-based: signup / login / logout)

Email+password auth using an **httpOnly session cookie** (not a Bearer token, by
the frontend team's choice — the JS never sees the credential). Implement these
three endpoints and scope the data endpoints to the user behind the cookie.

### `POST /auth/signup`
```bash
curl -i -X POST "http://localhost:8000/auth/signup" \
  -H "Content-Type: application/json" --cookie-jar cookies.txt \
  -d '{ "email": "user@example.com", "password": "secret123" }'
```
**Response `200`** — sets the cookie and returns the user:
```
Set-Cookie: klar_session=<opaque>; HttpOnly; Path=/; SameSite=None; Secure
```
```json
{ "user": { "id": "usr_1", "email": "user@example.com" } }
```
Errors: `409` `{"detail":"Email already registered"}`, `422` `{"detail":"Invalid email or password"}`.

### `POST /auth/login`
```bash
curl -i -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" --cookie-jar cookies.txt \
  -d '{ "email": "user@example.com", "password": "secret123" }'
```
**Response `200`** — same `Set-Cookie` + `{ user }`. Errors: `401` `{"detail":"Invalid credentials"}`.

### `POST /auth/logout`
Clears the cookie. **Response `204`** with `Set-Cookie: klar_session=; Max-Age=0`.

### Cookie usage & CORS (important)
- The frontend sends **every** request (§4 + reply) with `credentials: "include"`,
  so the browser attaches the cookie automatically. There is **no** `Authorization`
  header.
- Scope `GET /letters/{id}`, `GET /actions`, `POST /letters`, etc. to the user
  behind the cookie. An expired/invalid cookie → return **`401`**; the frontend
  then signs out and redirects to `/login`.
- **CORS for cookies:** set `allow_credentials=True` and list **explicit** origins
  (you **cannot** use `"*"` with credentials). In production the frontend
  (vercel.app) and backend are cross-site, so the cookie must be
  `SameSite=None; Secure`. Locally, `SameSite=Lax` over http is fine.
- The cookie should be `HttpOnly` (and `Secure` in prod). Session lifetime is your
  call (e.g. 7–30 days).
- **Optional but recommended:** `GET /auth/me` → `{ user }` (or `401`) so the
  frontend can validate the session on boot. Not required today.

> Shapes: `token` is any opaque string (JWT recommended). `user` is
> `{ "id": string, "email": string }`. `id` may be a UUID.

---

## 4. Endpoint reference — full request/response templates

### 4.1 `POST /letters?lang=<code>` — upload & extract (synchronous)

The core call. Frontend shows the reading animation and awaits the **complete**
result (run OCR → extraction → risk scoring before responding; multi-second is
fine).

**Request**
```
POST /letters?lang=en
Content-Type: multipart/form-data
  file=<binary>          # image/jpeg | image/png | application/pdf
```

```bash
curl -X POST "http://localhost:8000/letters?lang=en" \
  -F "file=@behoerdenbrief.jpg"
```

**Response `200` — full template**
```json
{
  "id": "8f4c1e2a-5b6d-4e7f-9a0b-1c2d3e4f5a6b",
  "institution": "Ausländerbehörde Berlin",
  "document_type": "Aufforderung zur Nachreichung",
  "category": "immigration",
  "summary_en": "The immigration office is missing documents from your residence-permit file and wants them within 14 days.",
  "actions": [
    {
      "id": "a1000000-0000-4000-8000-000000000001",
      "title": "Submit the missing documents within 14 days",
      "description": "Your application is on hold until these arrive.",
      "deadline": "2026-06-20",
      "severity": "critical",
      "risk_score": 88,
      "status": "open",
      "steps": [
        "Current enrolment certificate (Immatrikulationsbescheinigung)",
        "Proof of health insurance",
        "Blocked-account statement (Sperrkonto)"
      ],
      "evidence_span": "Bitte reichen Sie die fehlenden Unterlagen innerhalb von 14 Tagen nach.",
      "reply_needed": true
    }
  ],
  "extraction_warnings": []
}
```

**Errors**
```json
// 400 — wrong file type
{ "detail": "Only image or PDF files are accepted" }
// 422 — no file field (FastAPI validation; frontend shows a generic error)
{ "detail": [ { "loc": ["body","file"], "msg": "field required", "type": "value_error.missing" } ] }
```

Notes: a letter with no obligations returns `"actions": []` (the UI shows
"Nothing to do — just for your records"). Include `risk_score` **and** `status`
on every action (see §3 consistency tip).

---

### 4.2 `GET /letters/{id}?lang=<code>` — fetch one letter

**Request**
```bash
curl "http://localhost:8000/letters/8f4c1e2a-5b6d-4e7f-9a0b-1c2d3e4f5a6b?lang=de"
```

**Response `200`** — same `Letter` shape as §4.1, localized to `lang` (here `de`):
```json
{
  "id": "8f4c1e2a-5b6d-4e7f-9a0b-1c2d3e4f5a6b",
  "institution": "Ausländerbehörde Berlin",
  "document_type": "Aufforderung zur Nachreichung",
  "category": "immigration",
  "summary_en": "Der Ausländerbehörde fehlen Unterlagen aus deiner Aufenthaltsakte; sie sollen innerhalb von 14 Tagen nachgereicht werden.",
  "actions": [
    {
      "id": "a1000000-0000-4000-8000-000000000001",
      "title": "Die fehlenden Unterlagen innerhalb von 14 Tagen einreichen",
      "description": "Dein Antrag ruht, bis diese eingehen.",
      "deadline": "2026-06-20",
      "severity": "critical",
      "risk_score": 88,
      "status": "open",
      "steps": [
        "Aktuelle Immatrikulationsbescheinigung",
        "Nachweis der Krankenversicherung",
        "Sperrkonto-Nachweis"
      ],
      "evidence_span": "Bitte reichen Sie die fehlenden Unterlagen innerhalb von 14 Tagen nach.",
      "reply_needed": true
    }
  ],
  "extraction_warnings": []
}
```
`404` → `{ "detail": "Letter not found" }`.

---

### 4.3 `GET /actions?lang=<code>&status=<status>` — obligations feed

Powers the home feed, the deadlines calendar, and the agenda. `status` optional
(`open|done|ignored`); omit to return all.

**Request**
```bash
curl "http://localhost:8000/actions?lang=en"
curl "http://localhost:8000/actions?lang=en&status=open"
```

**Response `200`**
```json
[
  {
    "id": "a1000000-0000-4000-8000-000000000001",
    "letter_id": "8f4c1e2a-5b6d-4e7f-9a0b-1c2d3e4f5a6b",
    "title": "Submit the missing documents within 14 days",
    "deadline": "2026-06-20",
    "severity": "critical",
    "status": "open",
    "reply_needed": true
  },
  {
    "id": "b2000000-0000-4000-8000-000000000002",
    "letter_id": "1a2b3c4d-0000-4000-8000-000000000099",
    "title": "Pay €110.40 or apply for an exemption",
    "deadline": "2026-06-12",
    "severity": "medium",
    "status": "open",
    "reply_needed": true
  }
]
```
`letter_id` **must** equal the owning `Letter.id` (the frontend deep-links to
`/letters/{letter_id}`).

---

### 4.4 `PATCH /actions/{id}` — update an obligation

The frontend's "Mark done" / "Reopen" buttons. Body is a partial update; the
frontend currently sends only `status`.

**Request**
```bash
curl -X PATCH "http://localhost:8000/actions/a1000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{ "status": "done" }'
```
Body schema (all optional): `{ "status": "open|done|ignored", "deadline": "YYYY-MM-DD", "title": "string", "description": "string" }`

**Response `200`**
```json
{ "id": "a1000000-0000-4000-8000-000000000001", "status": "done" }
```
`404` → `{ "detail": "Action not found" }`. The change must persist (subsequent
`GET /actions` / `GET /letters/{id}` reflect it).

---

### 4.5 `POST /rag/search` — grounded legal answer (detail chat)

The "Ask a follow-up" chat sends the user's question; the frontend renders
`hits[0].text` and, if present, `metadata.section` as the citation label.

**Request**
```bash
curl -X POST "http://localhost:8000/rag/search" \
  -H "Content-Type: application/json" \
  -d '{ "query": "Was passiert, wenn ich die Frist verpasse?", "institution": "Ausländerbehörde Berlin", "top_k": 4 }'
```

**Response `200`**
```json
{
  "hits": [
    {
      "text": "§ 82 AufenthG — Mitwirkung des Ausländers. Fehlende Unterlagen sind innerhalb der gesetzten Frist nachzureichen, sonst kann der Antrag abgelehnt werden.",
      "score": 0.86,
      "metadata": { "law": "AufenthG", "section": "§ 82", "institution": "Ausländerbehörde Berlin" }
    }
  ]
}
```
Keep `text` **in German** (legal source). `metadata` is free-form; include
`section` if you can — the frontend shows it as the citation. Empty `hits: []` is
valid (the chat falls back to a generic answer).

---

### 4.6 `GET /health`

**Response `200`**
```json
{ "status": "ok", "service": "klar", "model": "qwen3.7-plus" }
```
Shown on the Me screen as a backend status indicator.

---

### 4.7 `POST /letters/{id}/reply?lang=<code>` — generate the done-for-you reply

The detail screen's "Generate my reply". Produces a ready-to-send **Behördendeutsch**
letter (always German), pre-filled with the applicant's details that the frontend
sends from its profile vault.

**Request**
```bash
curl -X POST "http://localhost:8000/letters/8f4c…/reply?lang=en" \
  -H "Content-Type: application/json" --cookie cookies.txt \
  -d '{ "action_id": "a1000…", "applicant": { "name": "Danial Eyvazi", "address": "Torstraße 140, 10119 Berlin" } }'
```
`action_id` and `applicant` are optional. `applicant` is a free-form
`{ field: value }` map (name, address, …) the model should weave into the letter.

**Response `200`**
```json
{
  "body_text": "Finanzamt Hamburg-Mitte\nSteuernummer: 22/345/67890\n\nBetreff: Einspruch …\n\nMit freundlichen Grüßen\nDanial Eyvazi",
  "language": "de",
  "download_url": null
}
```
`body_text` is **German** regardless of `?lang`. `download_url` is optional — return
a PDF URL if you render one; otherwise `null` (the frontend offers copy / .txt /
print-to-PDF client-side).

---

## B. Reminders & push (calendar is client-side)

- **Calendar export is fully client-side** — the frontend generates an `.ics`
  from an action's `deadline`. No backend work needed.
- **Push reminders (optional):** for real scheduled web-push (not just the
  in-page Notification permission), add `POST /push/subscribe` accepting a
  standard `PushSubscription` JSON and store it against the user; send a push as
  deadlines approach. The `ActionItem`/User model already carries
  `calendar_synced` / `calendar_connected` flags for this. Until then the frontend
  uses the local Notification API.

---

## 5. What the frontend sends YOU (outbound summary)

Everything the frontend will ever transmit, so nothing surprises you:

| Trigger | Request |
|---------|---------|
| Sign up / sign in | `POST /auth/signup` or `/auth/login` `{ email, password }` |
| User scans/uploads a letter | `POST /letters?lang=<code>` multipart `file` |
| Open a letter / refresh | `GET /letters/{id}?lang=<code>` |
| Home, Deadlines, Documents load | `GET /actions?lang=<code>` (sometimes `&status=`) |
| "Mark done" / edit obligation | `PATCH /actions/{id}` `{ status }` or `{ title, deadline }` |
| Generate the reply | `POST /letters/{id}/reply` `{ action_id?, applicant? }` |
| Ask-a-follow-up chat | `POST /rag/search` `{ query, institution?, top_k? }` |
| Sign out | `POST /auth/logout` |
| Me screen / boot | `GET /health` |

Once signed in, **every** request above is sent with `credentials: "include"`, so
the **session cookie** rides along automatically. No `Authorization` header.
Note: the "Mark done" PATCH and the **edit-obligation** PATCH share `/actions/{id}`
— edits send `{ title }` and/or `{ deadline }` (the backend's `UserCorrection`
loop logs these).

## 6. What YOU send the frontend (inbound summary)

- `Letter` with localized `summary_en` + `actions[]` (each: localized
  `title`/`description`/`steps`, `deadline`, `severity`, `risk_score` 0–100,
  `status`, German `evidence_span`, `reply_needed`) + localized
  `extraction_warnings[]`. German `institution` + `document_type`.
- `ActionListItem[]` from `/actions`.
- `{ id, status }` from `PATCH`.
- `{ hits: [...] }` from `/rag/search` (German legal text).
- `{ status, service, model }` from `/health`.

---

## 7. Localization (`?lang=`)

The frontend appends `?lang=<code>` to `POST /letters`, `GET /letters/{id}`, and
`GET /actions`, and **re-fetches when the user changes language**. You localize
server-side from that param.

**Translate to `?lang`:** `summary_en`, `extraction_warnings[]`,
`ActionItem.title` / `description` / `steps[]`, `ActionListItem.title`.

**Keep verbatim German (never translate):** `institution`, `document_type`,
`ActionItem.evidence_span`, and `/rag/search` `hits[].text`.

Codes: `en de fa tr ar uk`. Persian (`fa`) and Arabic (`ar`) are RTL — that's
handled entirely on the frontend; you just translate the text. If you can't do a
language yet, return English and the UI still works.

**Same field, two languages** (only the marked fields change):

| Field | `?lang=en` | `?lang=de` |
|-------|-----------|-----------|
| `institution` | `Ausländerbehörde Berlin` | `Ausländerbehörde Berlin` (unchanged) |
| `document_type` | `Aufforderung zur Nachreichung` | unchanged |
| `summary_en` | `The immigration office is missing documents…` | `Der Ausländerbehörde fehlen Unterlagen…` |
| `actions[0].title` | `Submit the missing documents within 14 days` | `Die fehlenden Unterlagen innerhalb von 14 Tagen einreichen` |
| `actions[0].evidence_span` | `Bitte reichen Sie die fehlenden Unterlagen…` | unchanged (German) |

> **Current gap to close for production:** the implemented backend returns
> English only. Add `lang` to your generation/translation step and localize the
> fields above. No frontend change is needed — it already sends `?lang` and
> re-fetches on switch.

---

## 8. Error handling contract

| Situation | Status | Body | Frontend behavior |
|-----------|--------|------|-------------------|
| Bad file type on upload | `400` | `{"detail":"..."}` | Error toast / processing-failed screen |
| Unknown letter/action id | `404` | `{"detail":"... not found"}` | "Could not be found" |
| Missing/invalid body | `422` | FastAPI validation array | Generic error |
| Server/AI failure | `500` | `{"detail":"..."}` | Error state; user can retry |

Always return JSON (not an HTML error page) so the frontend can parse it. Prefer a
**string** `detail` for user-facing messages.

---

## 9. What the frontend does NOT need (don't over-build)

- **Auth is required but keep it minimal** — signup/login/logout → httpOnly
  session cookie (§A). No email verification, password reset, OAuth, or
  refresh-token rotation for v1.
- **No SSE / WebSockets / streaming.** `POST /letters` is one synchronous JSON
  response.
- **No payments, no response-letter draft, no checklist/citations endpoints.** The
  "what to do" is the `actions[]` array; legal grounding is `/rag/search`.
- **No list-all-letters endpoint required.** The frontend derives the list from
  `GET /actions` + per-letter `GET /letters/{id}`. *(Optional optimization: if you
  add `GET /letters?lang=` returning `Letter[]`, tell us and we'll use it.)*
- **No pagination, filtering, or sorting params** beyond `?status=` on `/actions`.
  The frontend sorts/groups client-side.

---

## 10. Production integration checklist

You're done when, against the deployed backend:

- [ ] All six endpoints respond at the **root** path (no `/api`), no auth.
- [ ] `POST /letters` returns a complete `Letter` with non-empty `actions[]` for a
      real letter; each action has `title`, `severity`, `deadline|null`,
      `risk_score` (0–100), `status`, and (ideally) `evidence_span`.
- [ ] `GET /actions` rows carry `letter_id`s that resolve via `GET /letters/{id}`.
- [ ] `PATCH /actions/{id}` persists `{"status":"done"}` **and** `{title,deadline}`
      edits (logging UserCorrection), reflected on reload.
- [ ] `POST /letters/{id}/reply` returns `{ body_text (German), language, download_url }`.
- [ ] `POST /rag/search` returns `hits[]` with `text` (German) + `metadata.section`.
- [ ] `GET /health` returns `{status,service,model}`.
- [ ] Actions include `risk` breakdown; letters include `ocr_text` + `confidence`.
- [ ] `?lang=de` localizes `summary_en` / action `title`,`steps` /
      `extraction_warnings`, while `institution` / `document_type` /
      `evidence_span` / `ocr_text` stay German.
- [ ] `POST /auth/signup` + `/auth/login` set an **httpOnly cookie** and return
      `{ user }`; `POST /auth/logout` clears it; data endpoints are scoped to the
      cookie and return `401` when it's missing/invalid.
- [ ] CORS: `allow_credentials=True` with **explicit** origins (not `*`); cookie is
      `SameSite=None; Secure` in production.
- [ ] Frontend `NEXT_PUBLIC_API_URL` → backend origin, `NEXT_PUBLIC_API_MODE=live`.

When all boxes are checked, the frontend runs on real data with no code changes.
