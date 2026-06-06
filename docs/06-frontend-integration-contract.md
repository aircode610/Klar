# Klar — Frontend ⇄ Backend Integration Contract

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

Everything else (auth, SSE, payments, response-letter drafts, citations
endpoints, a list-all-letters endpoint) is **not required** — see §9.

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
    allow_headers=["Content-Type"],
)
```

---

## 2. Conventions

- **No auth.** The frontend sends no `Authorization` header and expects none.
- **Routers at root.** `/letters`, `/actions`, `/rag`, `/health`. **No `/api` prefix.**
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

interface ActionItem {
  id: string;
  title: string;                 // localized
  description?: string;          // localized
  deadline: string | null;       // "YYYY-MM-DD" | null
  severity: Severity;
  risk_score?: number;           // 0–100 integer
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
```

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

## 5. What the frontend sends YOU (outbound summary)

Everything the frontend will ever transmit, so nothing surprises you:

| Trigger | Request |
|---------|---------|
| User scans/uploads a letter | `POST /letters?lang=<code>` multipart `file` |
| Open a letter / refresh | `GET /letters/{id}?lang=<code>` |
| Home, Deadlines, Documents load | `GET /actions?lang=<code>` (sometimes `&status=`) |
| "Mark done" / "Reopen" | `PATCH /actions/{id}` `{ "status": "done"|"open" }` |
| Ask-a-follow-up chat | `POST /rag/search` `{ query, institution?, top_k? }` |
| Me screen / boot | `GET /health` |

It never sends auth headers, cookies, or any other endpoints.

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

- **No auth / users / JWT / cookies.**
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
- [ ] `PATCH /actions/{id}` `{"status":"done"}` persists and is reflected on reload.
- [ ] `POST /rag/search` returns `hits[]` with `text` (German) + `metadata.section`.
- [ ] `GET /health` returns `{status,service,model}`.
- [ ] `?lang=de` localizes `summary_en` / action `title`,`steps` /
      `extraction_warnings`, while `institution` / `document_type` /
      `evidence_span` stay German.
- [ ] CORS allows the Vercel origin for `GET, POST, PATCH, OPTIONS`.
- [ ] Frontend `NEXT_PUBLIC_API_URL` → backend origin, `NEXT_PUBLIC_API_MODE=live`.

When all boxes are checked, the frontend runs on real data with no code changes.
