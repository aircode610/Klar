# Klar — API Contract for the Frontend

This doc is the single source of truth for everything the frontend dev needs
to integrate with the Klar backend. If you only read one file, read this one.

For the machine-readable spec, see `postman/openapi.json` (regenerable
from `app.main:app.openapi()`).

---

## Base URL + auth model

- **Local dev:** `http://localhost:8000`
- **Production:** whatever you set as `BASE_URL` in your frontend env

Auth is **HttpOnly session cookies**, not bearer tokens. Every fetch:

```ts
fetch(`${BASE_URL}/api/some-endpoint`, {
  credentials: 'include',   // ← required everywhere
})
```

Every `EventSource`:

```ts
new EventSource(`${BASE_URL}/api/letters/${id}/process?lang=en`, {
  withCredentials: true,    // ← required
})
```

Without these flags the browser refuses to send the `klar_session` cookie and
you'll get 401 everywhere.

> Why cookies, not JWT? See `docs/02-backend.md` → "Modifications from Original
> Spec". TL;DR: HttpOnly cookies are XSS-immune, EventSource sends them
> automatically, and password reset can revoke all sessions atomically.

### CORS

Set `ALLOWED_ORIGINS` (comma-separated) in the backend `.env` to include your
frontend origin. **No wildcards** — credentialed CORS requires exact match.

Local dev defaults: `http://localhost:3000`, `http://localhost:5173`.
Production: add your Vercel domain. Capacitor/Ionic webview: add
`capacitor://localhost`, `ionic://localhost`.

When deploying to production, also flip in the backend env:
```
COOKIE_SECURE=true           # required for HTTPS
COOKIE_SAMESITE=none         # required for cross-origin (frontend ≠ backend domain)
```

---

## The error envelope (every non-2xx response, AND SSE error events)

```json
{
  "code":    "AUTH_INVALID_CREDENTIALS",
  "message": "Email or password is incorrect.",
  "details": null
}
```

- `code` — **stable** machine-readable identifier. Switch on this.
- `message` — user-facing copy. Already localized for display; you can
  override with your own translation keyed off `code`.
- `details` — optional structured extras. For `VALIDATION_ERROR` it carries
  `{ errors: [{ field, message }, ...] }`. Otherwise usually `null`.

### TypeScript type

```ts
type KlarError = {
  code: ErrorCode
  message: string
  details: ErrorDetails | null
}

type ErrorDetails = {
  errors?: { field: string; message: string }[]
  declared?: string
  detected?: string
}
```

### Recommended fetch wrapper

```ts
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const error: KlarError = await res.json()
    throw new ApiError(error, res.status)
  }
  return res.json()
}

class ApiError extends Error {
  constructor(public klar: KlarError, public status: number) {
    super(klar.message)
  }
}
```

Then in components:

```ts
try {
  const { user } = await api<{ user: UserPublic }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  // ...
} catch (e) {
  if (e instanceof ApiError && e.klar.code === 'AUTH_INVALID_CREDENTIALS') {
    setFormError('Wrong email or password')
  } else if (e instanceof ApiError && e.klar.code === 'VALIDATION_ERROR') {
    for (const fieldErr of e.klar.details?.errors ?? []) {
      setFieldError(fieldErr.field, fieldErr.message)
    }
  } else {
    setFormError(e.message)
  }
}
```

---

## Error code reference

Codes are versioned-stable strings. Renaming one is a breaking change.

### Generic

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Body / query / path failed Pydantic validation. `details.errors` has per-field info. |
| `HTTP_ERROR` | 4xx/5xx | Untyped fallback — shouldn't happen in well-behaved code. |
| `INTERNAL_ERROR` | 500 | Last-resort handler caught an unhandled exception. The user-facing message is generic; the real stack is server-side only. |

### Auth (4xx)

| Code | Status | Meaning |
|---|---|---|
| `AUTH_NOT_AUTHENTICATED` | 401 | No session cookie on the request. Redirect to login. |
| `AUTH_SESSION_EXPIRED` | 401 | Cookie present but the server-side session expired. Redirect to login. |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or wrong password (constant-time — same code either way). |
| `AUTH_EMAIL_TAKEN` | 409 | Signup with an email that already has an account. |
| `AUTH_INVALID_RESET_TOKEN` | 400 | Reset token unknown, already-used, or shaped wrong. |
| `AUTH_RESET_TOKEN_EXPIRED` | 400 | Reset token past its 15-minute TTL. Request a new one. |

### Letters (4xx)

| Code | Status | Meaning |
|---|---|---|
| `LETTER_NOT_FOUND` | 404 | No such letter, OR it belongs to another user. (Same response both cases — no info leak.) |
| `LETTER_FILE_MISSING` | 409 | Row exists but the file on disk is gone (orphan record). |
| `LETTER_EMPTY_UPLOAD` | 400 | Zero-byte upload. |
| `LETTER_TOO_LARGE` | 413 | >10 MB. |
| `LETTER_UNSUPPORTED_TYPE` | 415 | `Content-Type` not in JPEG/PNG/HEIC/WebP/PDF. |
| `LETTER_CORRUPT_FILE` | 415 | Magic bytes don't match any supported type — file is corrupted or hostile. |
| `LETTER_MIME_MISMATCH` | 415 | Declared type ≠ detected type. `details.declared` + `details.detected` show both. |

### Actions

| Code | Status | Meaning |
|---|---|---|
| `ACTION_NOT_FOUND` | 404 | No such action, OR not owned by user. |

### Pipeline / AI (5xx, mostly SSE)

| Code | Status (or SSE) | Meaning |
|---|---|---|
| `EXTRACTION_FAILED` | 502 / SSE | Model returned no tool call, or JSON parse failed. User-facing message: "We couldn't read this letter. Try a clearer photo." |
| `LLM_PROVIDER_ERROR` | 502 / SSE | Network error talking to Qwen, or the provider returned 5xx. |
| `PDF_RENDER_FAILED` | SSE | `pdf2image` / poppler failed on this PDF. Suggest uploading as image. |

---

## Endpoints

### Auth

#### `POST /api/auth/signup`

```ts
// Request
{
  "email":    "user@example.com",
  "password": "min 8 characters",
  "language": "en" | "de"      // optional, defaults to "en"
}

// 201 — cookie set by Set-Cookie header
{ "user": UserPublic }
```

Errors: `AUTH_EMAIL_TAKEN` (409), `VALIDATION_ERROR` (422).

#### `POST /api/auth/login`

```ts
// Request
{ "email": string, "password": string }

// 200 — cookie set
{ "user": UserPublic }
```

Errors: `AUTH_INVALID_CREDENTIALS` (401), `VALIDATION_ERROR` (422).

#### `POST /api/auth/logout`

No body. Returns `{ "ok": true }`. Server deletes the session row and clears the cookie.

Errors: `AUTH_NOT_AUTHENTICATED` (401).

#### `GET /api/auth/me`

Returns the current user from the cookie. Use this on app load to determine "are they signed in?".

```ts
// 200
{ "user": UserPublic }
```

Errors: `AUTH_NOT_AUTHENTICATED` (401) — that means "not signed in", not "broken".

#### `POST /api/auth/forgot-password`

```ts
// Request
{ "email": string }

// 200 — IDENTICAL shape whether the email is registered or not
{
  "ok": true,
  "message": "If that email is registered, a reset link has been sent.",
  "dev_reset_token":   "abc...",        // dev mode ONLY
  "dev_expires_at":    "2026-..."       // dev mode ONLY
}
```

In dev mode (`DEV_AUTH_EXPOSE_RESET_TOKEN=true`) the response carries the
reset token so the frontend can drive the reset flow end-to-end without
needing an SMTP server. Production never exposes it.

#### `POST /api/auth/reset-password`

```ts
// Request
{ "token": string, "new_password": "min 8 characters" }

// 200
{ "ok": true }
```

Side effect: every existing session for that user is deleted (so the user is
signed out of all devices). The cookie on the calling request is also cleared.

Errors: `AUTH_INVALID_RESET_TOKEN` (400), `AUTH_RESET_TOKEN_EXPIRED` (400).

### Letters

#### `POST /api/letters/upload` (multipart)

```ts
const fd = new FormData()
fd.append('file', fileFromCameraOrInput)   // JPEG/PNG/HEIC/WebP/PDF

const res = await fetch(`${BASE_URL}/api/letters/upload?lang=en`, {
  method: 'POST',
  body: fd,
  credentials: 'include',
})
const { letter_id } = await res.json()
```

Constraints:
- Max 10 MB
- Backend re-validates MIME via magic bytes (defends against renamed binaries)
- `?lang=` optional — defaults to user's `language`. Overrides on this letter.

Returns: `{ letter_id: UUID }`. Status is `uploaded`. **No AI yet.**

Errors: `LETTER_EMPTY_UPLOAD` (400), `LETTER_TOO_LARGE` (413),
`LETTER_UNSUPPORTED_TYPE` (415), `LETTER_CORRUPT_FILE` (415),
`LETTER_MIME_MISMATCH` (415).

#### `GET /api/letters/{letter_id}/process` (SSE — the main event)

```ts
const events = new EventSource(
  `${BASE_URL}/api/letters/${letterId}/process?lang=en`,
  { withCredentials: true }
)
events.addEventListener('ocr_result',    handle)
events.addEventListener('classification',handle)
events.addEventListener('risk_score',    handle)
events.addEventListener('deadline',      handle)
events.addEventListener('consequence',   handle)
events.addEventListener('explanation',   handle)   // streaming, multiple frames
events.addEventListener('response_draft',handle)   // streaming, conditional
events.addEventListener('checklist',     handle)
events.addEventListener('citations',     handle)
events.addEventListener('done', () => events.close())
events.addEventListener('error', (e) => {
  const err = JSON.parse((e as MessageEvent).data) as KlarError
  // err.code is EXTRACTION_FAILED / LLM_PROVIDER_ERROR / PDF_RENDER_FAILED / etc.
  events.close()
})
```

#### SSE event payloads

Each event's `data:` frame is a JSON object. Types (see `app/schemas.py`):

```ts
type SSEEventMap = {
  ocr_result:     { text: string }
  classification: {
    type: string                            // German doc name, e.g. "Mahnung"
    category: DocumentCategory              // closed enum, see below
    agency: string                          // sender, e.g. "AOK Bayern"
    category_confidence: number             // 0..1
  }
  risk_score:     { score: number; label: 'Critical' | 'High' | 'Medium' | 'Low' }
  deadline:       { date: string | null; days_remaining: number | null; note?: string }
  consequence:    { text: string }
  explanation:    { chunk: string }         // arrives many times
  response_draft: { chunk: string }         // arrives many times, in German
  checklist:      { items: string[] }
  citations:      { items: { section: string; text: string; score: number }[] }
  done:           { letter_id: string }
  error:          KlarError                 // same envelope as HTTP errors
}
```

Frontend pattern: maintain a local accumulator for `explanation` and
`response_draft` chunks — append them as they arrive, render the accumulated
string each render.

#### `POST /api/letters/{letter_id}/extract`

Synchronous fallback for clients that don't speak SSE. Returns the full
`LetterResponse` after running the structured Qwen call. Does NOT populate the
long-form fields (`explanation`, `response_draft`, `checklist`, `citations`).

Errors: `LETTER_NOT_FOUND`, `LETTER_FILE_MISSING`, `EXTRACTION_FAILED`.

#### `GET /api/letters`

```ts
// Optional filters:
//   ?status=uploaded|processing|completed|error
//   ?category=health_insurance|tax|immigration|...   (see DocumentCategory)
// Empty string for either is treated as "no filter" — safe to bind to React state.

// Returns LetterListItem[]
```

#### `GET /api/letters/{letter_id}`

Full `LetterResponse`. Use this after `done` to fetch the final state if you
missed any events or want to re-render from a fresh source.

### Actions

#### `GET /api/actions`

Lists every action across all of the user's letters. `?status=open|done|ignored` optional.

#### `PATCH /api/actions/{action_id}`

Send only the fields you want to change:

```ts
{
  "status":       "done" | "ignored" | "open" | undefined,
  "deadline":     "YYYY-MM-DD" | null | undefined,
  "title":        string | undefined,
  "description":  string | undefined,
}
```

Every changed field is logged to `UserCorrection` server-side. Returns
`{ id, status }`.

### Deadlines

#### `GET /api/deadlines`

A view over `ActionItem` in flat deadline shape — for the deadline calendar /
urgency-sorted dashboard.

```ts
// Returns DeadlineItem[]:
{
  id: string                                // ActionItem ID
  letter_id: string
  title: string
  due_date: string                          // "YYYY-MM-DD", "9999-12-31" if include_no_date and date was null
  status: 'open' | 'done' | 'ignored'
  risk_score: number                        // 0..100
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: DocumentCategory
}
```

Sorted by `due_date` ASC (most urgent first). Pass `?include_no_date=true` to
include actions without an extracted date (they'll show `9999-12-31`).

### RAG (debug surface)

`POST /api/rag/search` and `POST /api/rag/reseed` — useful in dev for
exploring the corpus; not part of the main user flow.

---

## Enums

`DocumentCategory`:

```ts
type DocumentCategory =
  | 'health_insurance'    // AOK, TK, BARMER, private KV
  | 'other_insurance'     // Allianz, HUK, ADAC (Haftpflicht, KFZ, etc.)
  | 'banking'             // Sparkasse, DB, N26, SCHUFA
  | 'tax'                 // Finanzamt
  | 'immigration'         // Ausländerbehörde
  | 'education'           // Uni, Studentenwerk, BAföG
  | 'housing'             // Vermieter, Hausverwaltung
  | 'utilities'           // Strom/Gas/Wasser/Internet/Mobilfunk
  | 'employment'          // Arbeitgeber, HR, Lohn
  | 'government_benefits' // ALG, Kindergeld, Elterngeld, Wohngeld
  | 'pension'             // Deutsche Rentenversicherung
  | 'broadcast_fee'       // Beitragsservice / GEZ
  | 'civic'               // Bürgeramt, Pass, Ausweis
  | 'legal_debt'          // Mahnbescheid, Inkasso, Bußgeld
  | 'other'
```

`Severity`: `'critical' | 'high' | 'medium' | 'low'`.
`ActionStatus`: `'open' | 'done' | 'ignored'`.
`LetterStatus`: `'uploaded' | 'processing' | 'completed' | 'error'`.
`DeadlineSource`: `'explicit' | 'inferred' | 'unknown'`.

---

## Mobile considerations

Already covered by the backend:

- **Two-step upload→process pattern** survives flaky connections — the upload
  finishes fast, the SSE stream can be dropped + restarted.
- **HEIC accepted** (iPhone default format). HEIC is decoded backend-side
  before going to Qwen.
- **Magic-bytes validation** — phones sometimes send wonky `Content-Type`
  headers; backend re-checks the actual bytes.

To handle yourself (frontend):

- Use `<input type="file" accept="image/*,application/pdf" capture="environment">`
  to open the rear camera directly.
- iPhone photos arrive sideways via EXIF — render with `image-orientation: from-image`
  CSS, or use `<canvas>` to bake the rotation if you want to preview before upload.
- For SSE auto-reconnect on a dropped connection, treat any letter that's
  `status: processing` longer than 30 seconds as orphaned — refetch via
  `GET /api/letters/{id}` and check the status. If still processing, reopen
  the SSE.

---

## Example flows

### Sign up + upload + watch the pipeline run

```ts
// 1. Signup (cookie is set automatically)
await api('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    email: 'student@uni.de',
    password: 'a-decent-password',
    language: 'en',
  }),
})

// 2. Upload a Brief
const fd = new FormData()
fd.append('file', briefFile)
const { letter_id } = await fetch(`${BASE_URL}/api/letters/upload`, {
  method: 'POST', body: fd, credentials: 'include',
}).then(r => r.json())

// 3. Stream the pipeline
const events = new EventSource(
  `${BASE_URL}/api/letters/${letter_id}/process?lang=en`,
  { withCredentials: true },
)
let explanationBuf = ''
events.addEventListener('classification', (e) =>
  setClassification(JSON.parse((e as MessageEvent).data)))
events.addEventListener('explanation', (e) => {
  explanationBuf += JSON.parse((e as MessageEvent).data).chunk
  setExplanation(explanationBuf)
})
events.addEventListener('done', () => events.close())
events.addEventListener('error', (e) => {
  const err = JSON.parse((e as MessageEvent).data) as KlarError
  toast(err.message)
  events.close()
})
```

### Auth bootstrap on app load

```ts
async function bootstrapAuth() {
  try {
    const { user } = await api<{ user: UserPublic }>('/api/auth/me')
    return user
  } catch (e) {
    if (e instanceof ApiError && e.klar.code === 'AUTH_NOT_AUTHENTICATED') {
      return null  // not signed in — render login screen
    }
    throw e
  }
}
```

### Forgot password (dev mode)

```ts
const { dev_reset_token } = await api<{ dev_reset_token?: string }>(
  '/api/auth/forgot-password',
  { method: 'POST', body: JSON.stringify({ email }) },
)
if (dev_reset_token) {
  console.log('Dev reset token:', dev_reset_token)  // use directly in next step
}

await api('/api/auth/reset-password', {
  method: 'POST',
  body: JSON.stringify({ token: dev_reset_token, new_password: '...' }),
})
```

---

## Generating a TypeScript SDK

The backend's OpenAPI spec is at `postman/openapi.json` (regenerable).
To produce a typed SDK:

```bash
npx openapi-typescript postman/openapi.json -o frontend/src/lib/api-types.ts
```

That gives you path-keyed types for every endpoint, every response shape,
every error envelope. Then your `api()` wrapper can be statically typed.

---

## Open questions / TODOs for v2

- File-upload progress events (we can already track via `XMLHttpRequest.upload.onprogress`
  client-side — server doesn't need changes).
- SSE resume tokens — currently re-opening `/process` re-runs the pipeline.
  A "fetch the cached result if still in progress" mode would be cheaper.
- Soft-delete for letters (frontend wants to "archive" without losing data).
- Internationalization of `message` strings — currently English. Frontend can
  ignore `message` and map `code` to its own copy.
