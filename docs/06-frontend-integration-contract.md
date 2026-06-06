# Klar — Frontend Integration Contract

**What the backend (Dev 2) and AI (Dev 3/4) must send to the frontend.**

This is the exact contract the **frontend already consumes** today, derived from
`lib/api/client.ts` and `types/index.ts`. Build your responses to match these
shapes field-for-field and the frontend works with **zero changes** — just flip
`NEXT_PUBLIC_API_MODE=live` and point `NEXT_PUBLIC_API_URL` at the backend.

> Nothing here asks you to change your structure. It documents what the frontend
> sends and what it expects back.

---

## Ground rules

- **Base URL:** `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8000`). Routers are
  mounted at the **root** — `/letters`, `/actions`, `/rag`, `/health`. **No `/api`
  prefix.**
- **No auth.** The frontend sends no `Authorization` header and expects none.
- **CORS:** allow the frontend origin (`http://localhost:3000` and the Vercel
  domain), methods `GET, POST, PATCH`, and the `Content-Type` header.
- **Errors:** return the right HTTP status (400/404/422/500…). The frontend reads
  FastAPI's default `{ "detail": "..." }` body for the message. Any non-2xx is
  surfaced as an error state.
- **Dates:** deadlines are **date-only** strings, `"YYYY-MM-DD"`, or `null`.
- **Language:** the frontend appends `?lang=<code>` to content requests
  (`/letters`, `/actions`). `<code>` ∈ `en | de | fa | tr | ar | uk`. See
  [Localization](#localization).

---

## Endpoints the frontend calls

### 1. `POST /letters?lang=<code>` — upload + extract

- **Request:** `multipart/form-data`, single field **`file`** (`image/jpeg`,
  `image/png`, or `application/pdf`).
- **Synchronous:** the frontend shows a reading animation and `await`s the full
  result. Return the **complete extracted letter** (run OCR → extraction → risk
  before responding). Taking several seconds is fine.
- **Response `200`:** a [`Letter`](#letter) object.

### 2. `GET /letters/{id}?lang=<code>` — fetch one letter

- **Response `200`:** a [`Letter`](#letter). `404` if not found.

### 3. `GET /actions?lang=<code>&status=<status>` — obligations feed

- `status` is optional ∈ `open | done | ignored`.
- This powers the home feed, the deadlines calendar, and the agenda.
- **Response `200`:** an array of [`ActionListItem`](#actionlistitem).

### 4. `PATCH /actions/{id}` — update an obligation

- **Request body (JSON):** any subset of
  `{ "status": "done", "deadline": "YYYY-MM-DD", "title": "...", "description": "..." }`.
  The frontend currently only sends `status` (`done` / `open`) from "Mark done".
- **Response `200`:** `{ "id": "<uuid>", "status": "<status>" }`.

### 5. `POST /rag/search` — grounded follow-up (the detail chat)

- **Request body (JSON):** `{ "query": "...", "top_k": 4, "institution": "AOK Bayern" }`
  (`top_k` and `institution` optional).
- **Response `200`:** `{ "hits": [ { "text": "...", "score": 0.0, "metadata": { ... } } ] }`.
  The frontend displays `hits[0].text` and, if present, `metadata.section` as the
  citation label (e.g. `"§ 81 Abs. 4 AufenthG"`). Keep `text` **in German** (it is
  legal source text).

### 6. `GET /health`

- **Response `200`:** `{ "status": "ok", "service": "klar", "model": "qwen3.7-plus" }`.
  Shown on the Me screen.

---

## Data shapes (exact)

### Letter

Returned by `POST /letters` and `GET /letters/{id}`.

```json
{
  "id": "ltr_finanzamt",
  "institution": "Finanzamt Hamburg-Mitte",
  "document_type": "Steuerbescheid",
  "category": "tax",
  "summary_en": "The tax office assessed €412 owed for 2024. You can object within one month if the figures look wrong.",
  "actions": [ /* ActionItem[] */ ],
  "extraction_warnings": []
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✅ | Any stable id (UUID is fine). Used in the URL `/letters/{id}`. |
| `institution` | string | ✅ | Sender, **as printed** (German). **Not** localized. |
| `document_type` | string | ✅ | German doc name (`Steuerbescheid`, `Mahnung`…). **Not** localized. |
| `category` | enum | ✅ | One of [`DocumentCategory`](#enums). Drives the icon + label. |
| `summary_en` | string | ✅ | The plain-language summary. **Localized** to `?lang` (keep the field name). |
| `actions` | ActionItem[] | ✅ | May be empty (`[]`) for purely informational letters. |
| `extraction_warnings` | string[] | ✅ | e.g. `["Deadline may have passed."]`. **Localized**. Use `[]` if none. |

### ActionItem

The obligations inside a `Letter`.

```json
{
  "id": "act_12",
  "title": "Pay €412 or file an objection (Einspruch)",
  "description": "",
  "deadline": "2026-06-20",
  "severity": "medium",
  "risk_score": 49,
  "status": "open",
  "steps": ["Check the assessment against your records", "..."],
  "evidence_span": "Gegen diesen Bescheid kann innerhalb eines Monats … Einspruch eingelegt werden.",
  "reply_needed": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✅ | Used by `PATCH /actions/{id}`. |
| `title` | string | ✅ | The action, imperative. **Localized**. |
| `description` | string | optional | Extra context. **Localized**. `""`/omit if none. |
| `deadline` | string\|null | ✅ | `"YYYY-MM-DD"` or `null`. |
| `severity` | enum | ✅ | One of [`Severity`](#enums). |
| `risk_score` | number | recommended | Integer **0–100** (your server-side formula). Renders a bar. |
| `status` | enum | recommended | One of [`ActionStatus`](#enums). Frontend defaults to `open` if absent. |
| `steps` | string[] | optional | Checklist of sub-steps / documents. **Localized**. |
| `evidence_span` | string | optional | Exact **German** source sentence. **Not** localized. |
| `reply_needed` | boolean | optional | Shows a "Reply needed" badge. |

> Consistency tip: your upload response includes `risk_score` but not `status`,
> and `GET /letters/{id}` includes `status` but not `risk_score`. The frontend
> tolerates both, but **please include both `risk_score` and `status` on every
> action** so the UI is consistent on both screens.

### ActionListItem

Returned by `GET /actions` (one row per obligation, joined to its letter).

```json
{
  "id": "act_12",
  "letter_id": "ltr_finanzamt",
  "title": "Pay €412 or file an objection (Einspruch)",
  "deadline": "2026-06-20",
  "severity": "medium",
  "status": "open",
  "reply_needed": true
}
```

All fields required. `title` is **localized**; `letter_id` must match the
`Letter.id` so the frontend can deep-link to `/letters/{letter_id}`.

### Enums

```
DocumentCategory:
  health_insurance | other_insurance | banking | tax | immigration |
  education | housing | utilities | employment | government_benefits |
  pension | broadcast_fee | civic | legal_debt | other

Severity:      critical | high | medium | low
ActionStatus:  open | done | ignored
```

Send values **exactly** as above (lowercase, snake_case). Unknown category values
fall back to a generic icon; unknown severities are treated as `medium`.

---

## Localization

The frontend passes the user's language as `?lang=<code>` on `POST /letters`,
`GET /letters/{id}`, and `GET /actions`. The backend is responsible for returning
the human-readable fields **already translated** into that language.

**Translate these fields to `?lang`:**
- `Letter.summary_en` (yes — translate it despite the `_en` name)
- `Letter.extraction_warnings[]`
- `ActionItem.title`, `ActionItem.description`, `ActionItem.steps[]`
- `ActionListItem.title`

**Keep verbatim (always German, never translated):**
- `institution`, `document_type`
- `ActionItem.evidence_span` (the exact source quote)
- `/rag/search` `hits[].text` (legal source text)

Supported codes: `en, de, fa, tr, ar, uk`. If you can't translate a given
language yet, return English — the UI still works; it just won't be localized for
that language.

> **This is the current gap.** The implemented backend returns `summary_en` (and
> action fields) in English only. To make the multilingual feature work live, add
> the `lang` parameter to the generation/extraction prompt (or a translation
> pass) and localize the fields listed above. The frontend already sends `?lang`
> and re-fetches on language change, so no frontend work is needed once you do.

---

## What the frontend does NOT need

So you don't over-build:

- **No auth / users / JWT.** Not sent, not expected.
- **No SSE / streaming.** `POST /letters` is a normal synchronous JSON response.
- **No payments, no response-letter draft, no checklist/citations endpoints.**
  The "what to do" is the `actions` array; legal grounding comes from
  `/rag/search`.
- **No "list all letters" endpoint required.** The frontend builds the list from
  `GET /actions` + per-letter `GET /letters/{id}`. (If you add `GET /letters`
  returning `Letter[]`, that's a welcome optimization but optional.)

---

## Quick self-check for the backend

You're integrated when, against your live server:

1. `POST /letters` with an image returns a `Letter` whose `actions[]` each have
   `title`, `severity`, `deadline` (or null), `risk_score`, and `status`.
2. `GET /actions` returns rows with matching `letter_id`s.
3. `PATCH /actions/{id}` with `{"status":"done"}` returns `{"id","status"}` and the
   change persists.
4. `POST /rag/search` returns `hits[]` with `text` + `metadata.section`.
5. Passing `?lang=de` flips `summary_en`, action `title`/`steps`, and
   `extraction_warnings` to German while `institution` / `document_type` /
   `evidence_span` stay as printed.
6. CORS lets `http://localhost:3000` call all of the above.
