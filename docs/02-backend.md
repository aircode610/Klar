# Klar — Backend Spec

**Owner: Dev 2 (Backend)**
**Stack: Python FastAPI + SQLite + JWT**
**Deploy: Railway or Render**

---

## Project Structure

```
backend/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── config.py                # Settings, env vars
├── db/
│   ├── database.py          # SQLite connection, session management
│   ├── models.py            # SQLAlchemy models (or raw SQL)
│   └── schema.sql           # Schema definition
├── auth/
│   ├── router.py            # /api/auth/* routes
│   ├── utils.py             # JWT creation, password hashing
│   └── dependencies.py      # get_current_user dependency
├── letters/
│   ├── router.py            # /api/letters/* routes
│   └── schemas.py           # Pydantic models for request/response
├── deadlines/
│   ├── router.py            # /api/deadlines/* routes
│   └── schemas.py
├── pipeline/
│   ├── orchestrator.py      # SSE streaming orchestrator
│   └── schemas.py           # Pipeline data models (AgentResult, RAGResult)
├── uploads/                 # Stored uploaded files
└── data/
    └── klar.db              # SQLite database file
```

---

## API Endpoints

### Auth

```
POST /api/auth/signup
  Body: { "email": "user@example.com", "password": "secret123" }
  Response: { "token": "eyJ...", "user": { "id": 1, "email": "..." } }
  Errors: 409 (email exists), 422 (validation)

POST /api/auth/login
  Body: { "email": "user@example.com", "password": "secret123" }
  Response: { "token": "eyJ...", "user": { "id": 1, "email": "..." } }
  Errors: 401 (invalid credentials)
```

### Letters

```
POST /api/letters/upload
  Auth: Bearer token required
  Body: multipart/form-data with file field
  Accepts: image/jpeg, image/png, application/pdf
  Response: { "letter_id": 42 }
  Behavior:
    - Save file to uploads/ directory
    - If PDF, convert ALL pages to images using pdf2image (letters may span 2+ pages)
    - For multi-page PDFs, concatenate OCR results from all pages
    - Create letter record in SQLite (status: "uploaded")
    - Return letter ID

GET /api/letters/{id}/process?token=JWT&lang=en
  Auth: JWT passed as query param (EventSource does NOT support custom headers)
  Language: Passed as query param "lang" (e.g., ?lang=en, ?lang=de, ?lang=tr)
  Response: text/event-stream (SSE)
  Behavior:
    - Load the letter's uploaded file
    - Call AI pipeline steps sequentially
    - Stream each result as an SSE event
    - Save final results to SQLite
    - See "SSE Streaming" section below

GET /api/letters
  Auth: Bearer token required
  Response: [{ "id": 1, "letter_type": "...", "risk_score": 3, "deadline_date": "...", "created_at": "..." }, ...]

GET /api/letters/{id}
  Auth: Bearer token required
  Response: Full letter object with all fields
```

### Deadlines

```
GET /api/deadlines
  Auth: Bearer token required
  Response: [{ "id": 1, "letter_id": 5, "title": "...", "due_date": "...", "status": "pending", "risk_score": 4 }, ...]
  Sorted by: due_date ascending (most urgent first)
```

---

## SSE Streaming Protocol

The `/api/letters/{id}/process` endpoint is the heart of the system. It orchestrates the AI pipeline and streams results.

**Implementation with FastAPI:**

```python
from fastapi.responses import StreamingResponse
import json

@router.get("/api/letters/{letter_id}/process")
async def process_letter(letter_id: int, token: str, lang: str = "en"):
    user = verify_token(token)
    letter = get_letter(letter_id, user.id)

    async def event_stream():
        # Step 1: OCR
        ocr_text = await ocr_service.extract(letter.file_path)
        yield sse_event("ocr_result", {"text": ocr_text})

        # Step 2: ReAct Agent
        async for event in react_agent.process(ocr_text):
            yield sse_event(event.type, event.data)
            # event types: "classification", "risk_score", "deadline", "consequence"

        # Step 3 + 4: RAG + Response Generation
        agent_result = react_agent.get_result()
        async for event in rag_pipeline.generate(ocr_text, agent_result, lang):
            yield sse_event(event.type, event.data)
            # event types: "explanation", "response_draft", "checklist", "citations"

        # Save to DB
        save_results(letter_id, ...)
        yield sse_event("done", {"letter_id": letter_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream")

def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
```

**SSE Event Types:**

| Event | Data | When |
|-------|------|------|
| `ocr_result` | `{ "text": "..." }` | After OCR completes |
| `classification` | `{ "type": "Residence Permit - Document Request", "agency": "Ausländerbehörde" }` | After classification |
| `risk_score` | `{ "score": 4, "label": "High" }` | After risk assessment |
| `deadline` | `{ "date": "2026-06-20", "days_remaining": 14 }` | After deadline extraction |
| `consequence` | `{ "text": "Application rejected. Must re-apply..." }` | After consequence analysis |
| `explanation` | `{ "chunk": "This letter is from..." }` | Streaming, multiple events |
| `response_draft` | `{ "chunk": "Sehr geehrte Damen..." }` | Streaming, multiple events |
| `checklist` | `{ "items": ["Proof of insurance", "Bank statements", ...] }` | Single event |
| `citations` | `{ "items": [{"section": "§ 81 Abs. 4 AufenthG", "text": "..."}] }` | Single event |
| `done` | `{ "letter_id": 42 }` | Pipeline complete |
| `error` | `{ "message": "..." }` | On any error |

---

## Database Schema

```sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    language      TEXT DEFAULT 'en',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE letters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    original_file   TEXT NOT NULL,
    ocr_text        TEXT,
    letter_type     TEXT,
    risk_score      INTEGER,
    explanation     TEXT,
    response_draft  TEXT,
    checklist       TEXT,                   -- JSON array
    citations       TEXT,                   -- JSON array
    deadline_date   DATE,
    consequence     TEXT,
    status          TEXT DEFAULT 'uploaded', -- uploaded, processing, completed, error
    processed_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deadlines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    letter_id   INTEGER NOT NULL REFERENCES letters(id),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    due_date    DATE NOT NULL,
    status      TEXT DEFAULT 'pending',     -- pending, completed, overdue
    risk_score  INTEGER
);
```

---

## Auth Implementation

- **Password hashing:** `bcrypt` via `passlib`
- **JWT:** `python-jose` with HS256 algorithm
- **Token expiry:** 24 hours (sufficient for hackathon)
- **Secret key:** Environment variable `JWT_SECRET`
- **Dependency injection:**

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(credentials = Depends(security)):
    token = credentials.credentials
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(401, "Invalid token")
    return user
```

---

## File Handling

- Uploaded files saved to `uploads/{user_id}/{letter_id}.{ext}`
- PDF conversion: `pdf2image` library (requires `poppler-utils` system dependency)
- Max file size: 10MB (enforced in FastAPI)
- Accepted MIME types: `image/jpeg`, `image/png`, `application/pdf`

---

## CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",          # local Next.js dev
        "https://klar-app.vercel.app",    # production frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Environment Variables

```
JWT_SECRET=<random-secret-string>
QWEN_API_KEY=<sponsor-provided-key>
QWEN_API_BASE=<sponsor-provided-endpoint>
DATABASE_URL=sqlite:///data/klar.db
UPLOAD_DIR=uploads
ALLOWED_ORIGINS=http://localhost:3000,https://klar-app.vercel.app
```

---

## Dependencies (requirements.txt)

```
fastapi
uvicorn[standard]
python-jose[cryptography]
passlib[bcrypt]
python-multipart
pdf2image
Pillow
aiosqlite
httpx
pydantic
```

---

## Integration with AI Pipeline

The backend does NOT implement AI logic. It calls functions provided by Dev 3 (RAG) and Dev 4 (ReAct).

**Interface contract with Dev 4 (ReAct Agent):**

```python
# backend calls this
async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]:
    """
    Yields events as the agent processes:
    - AgentEvent(type="classification", data={...})
    - AgentEvent(type="risk_score", data={...})
    - AgentEvent(type="deadline", data={...})
    - AgentEvent(type="consequence", data={...})
    """
```

**Interface contract with Dev 3 (RAG Pipeline):**

```python
# backend calls this
async def run_rag_pipeline(
    ocr_text: str,
    agent_result: AgentResult,
    language: str
) -> AsyncGenerator[RAGEvent, None]:
    """
    Yields events as the pipeline generates:
    - RAGEvent(type="explanation", data={"chunk": "..."})
    - RAGEvent(type="response_draft", data={"chunk": "..."})
    - RAGEvent(type="checklist", data={"items": [...]})
    - RAGEvent(type="citations", data={"items": [...]})
    """
```

Dev 2 imports these functions and wires them into the SSE orchestrator. The AI devs implement them independently.

---

## Hour-by-Hour Plan

| Hour | Deliverable |
|------|------------|
| 0-1 | FastAPI project init, SQLite schema, auth routes (signup/login/JWT) |
| 1-2 | File upload endpoint, PDF conversion, CORS setup |
| 2-3 | SSE streaming endpoint (scaffold with mock data first), letter CRUD |
| 3-4 | Deadline endpoints, pipeline orchestrator (wire in AI functions) |
| 4-5 | End-to-end integration with AI devs, error handling |
| 5-6 | Deploy to Railway/Render, smoke test full flow, final fixes |

---

> # ⚠️ MODIFICATIONS FROM ORIGINAL SPEC
>
> The implementation deviates from this spec in the ways listed below.
> Every deviation is intentional and motivated. **Keep this section in sync
> with the codebase.** Any future PR that changes one of these items must
> update the corresponding row here.

### Ownership change

The spec was written for 4 devs (Dev 1 frontend, Dev 2 backend, Dev 3 RAG,
Dev 4 ReAct agent). **Nuriel owns the entire backend solo**, so the
"interface contracts with Dev 3 / Dev 4" collapse into in-process function
calls. The backend now contains:

- `app/rag/` — the RAG store + seed corpus (was Dev 3's library)
- `app/services/extraction.py` — the single Qwen3.7-Plus tool-use call that
  replaces the ReAct agent (was Dev 4's library)
- `app/pipeline/orchestrator.py` — the SSE orchestrator that the spec
  describes

### 1. Auth: HttpOnly session cookies instead of Bearer JWT

| Spec | Implementation | Reason |
|---|---|---|
| Bearer JWT in `Authorization` header | HttpOnly + Secure (in prod) + SameSite=Lax session cookie, server-side `Session` table | XSS-immune (JS cannot read HttpOnly cookies); password reset can revoke all sessions atomically (single `DELETE` on the table); EventSource ships the cookie automatically with `withCredentials:true` — no need for the spec's `?token=` query-string, which leaks tokens into access logs and browser history. |
| `python-jose` HS256 | `bcrypt` (passwords) + 256-bit URL-safe random tokens (sessions) | Sessions are server-side so no JWT needed; the secret is the random token itself, with `JWT_SECRET` reserved as a per-deployment salt. |
| `POST /api/auth/signup`, `/login` | Same routes + `/logout`, `/me`, `/forgot-password`, `/reset-password` | Full-fledged auth: forgot-password flow (15-min single-use reset tokens), all-sessions-revoked on password change, identical responses for known/unknown emails on forgot-password (no user enumeration). |

### 2. UUID primary keys instead of `INTEGER AUTOINCREMENT`

| Spec | Implementation | Reason |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `UUID` primary keys throughout | Prevents `/api/letters/1, /2, /3` enumeration; safer to expose in URLs; trivial frontend change. **API contract impact:** the spec's example `"letter_id": 42` becomes a UUID string. |

### 3. Per-action granularity instead of flat single-deadline letters

| Spec | Implementation | Reason |
|---|---|---|
| `letters.deadline_date DATE` (one per letter) | Separate `ActionItem` table (PRD §7) carrying deadline + confidence + source + evidence_span per obligation; `Letter.deadline_date` is a **denormalized** mirror of the earliest action deadline | Real German letters often contain 2–3 obligations (pay invoice + submit form + confirm receipt). Spec's flat schema cannot represent these. We keep `Letter.deadline_date` and `Letter.risk_score` as denormalized convenience columns so the spec's `GET /api/letters` list response stays unchanged. |
| `deadlines` table (separate) | **Dropped.** `GET /api/deadlines` is now a view over `ActionItem` joined with `Letter` | No data is lost; the response shape matches the spec exactly. |

### 4. Enriched data model

Additions beyond the spec's letters/deadlines/users tables:

- **`DocumentCategory`** — closed enum of 15 categories (`health_insurance`,
  `other_insurance`, `banking`, `tax`, `immigration`, `education`, `housing`,
  `utilities`, `employment`, `government_benefits`, `pension`,
  `broadcast_fee`, `civic`, `legal_debt`, `other`). The spec only has a free
  text `letter_type`. We keep `letter_type` as a mirror of `document_type`
  for spec compatibility AND emit the enum for reliable frontend routing.
- **`evidence_span`** on every action — the exact German sentence the action
  came from. Hallucination defense; lets the UI render "extracted from this
  sentence" highlights.
- **`deadline_confidence` + `deadline_source` (`explicit`/`inferred`/
  `unknown`)** — lets the UI render "this deadline is inferred, please
  verify" warnings.
- **`RiskScore` separate table** — carries the breakdown of the 4 weighted
  components from PRD §4.5 alongside the integer score. The spec's flat
  `letters.risk_score INTEGER` is denormalized from the highest action's
  RiskScore.score.
- **`UserCorrection`** — every PATCH `/api/actions/{id}` that changes a
  field appends a row here. Future prompt-tuning dataset.
- **`Session`, `PasswordResetToken`** — required by the cookie-session +
  forgot-password flows.
- **`Letter.language`** — `en` or `de`, controls output language for
  `summary`, `explanation`, `checklist`, action `title`/`description`.

### 5. German + English language support

| Spec | Implementation | Reason |
|---|---|---|
| `?lang=` query parameter on `/process` | Same parameter, plus per-user `User.language` default and per-letter `Letter.language` persistence | `User.language` is captured at signup and used as the default; `?lang=` overrides per request. **`response_draft` is always German** (the formal reply goes to a German institution); all other generated text follows the chosen language. |

### 6. Pipeline: 2 Qwen calls instead of OCR → ReAct → RAG

| Spec stage | Implementation |
|---|---|
| 1. OCR (Google Vision / Tesseract) | Folded into Qwen3.7-Plus vision call — the `ocr_text` field comes back in the same tool_call as the structured extraction. No separate OCR step. |
| 2. ReAct Agent (multi-step classification → risk → deadline → consequence) | Single tool-use call with `extract_obligations` schema. Returns category, severity, all actions, deadlines, evidence in one shot. The SSE orchestrator splits the result back into the spec's 5 SSE events (`ocr_result`, `classification`, `risk_score`, `deadline`, `consequence`) for visual pacing. |
| 3. RAG Pipeline (explanation, response_draft, checklist, citations) | One streaming Qwen call for explanation + (conditionally) one streaming Qwen call for `response_draft` + one non-streaming Qwen call for `checklist` + ChromaDB hits as `citations`. |

Total per letter: **~3 Qwen calls + 1 RAG search**. The spec's per-event
shape is preserved; the cost is hidden internally.

### 7. Citations are RAG hits, not invented legal sections

The spec example shows `§ 81 Abs. 4 AufenthG` citations. To avoid
hallucinated law sections, **citations are the top-3 ChromaDB seed-corpus
hits** for the (institution, document_type, category) tuple — real grounding
evidence from `app/rag/seed.py`. Each citation carries `{section, text,
score}`. Future iteration could ground citations against an actual
gesetze-im-internet.de corpus.

### 8. `pdf2image` instead of single-page PDF assumption

Spec says: "If PDF, convert ALL pages to images using pdf2image (letters
may span 2+ pages)". Implemented as `app/services/pdf_pages.py`. Up to
**12 pages per PDF** rendered at 200 DPI, each sent as a separate image
content part to Qwen. **System dependency**: `poppler` (macOS `brew install
poppler`; Linux `apt-get install poppler-utils`).

### 9. SQLModel + `create_all()` instead of `db/schema.sql`

Spec proposes `db/schema.sql` + SQLAlchemy. We use **SQLModel** (Pydantic +
SQLAlchemy unified by the FastAPI author), with `SQLModel.metadata.create_all()`
in `database.init_db()` instead of a separate SQL file. Result: types are
shared between API responses and DB rows. No migrations needed for the
hackathon — destroy and recreate `data/klar.db` between schema iterations.

### 10. `openai` SDK is the wire-format client, not the model provider

`from openai import AsyncOpenAI` in `app/services/extraction.py` is **not**
a call to OpenAI's API. The OpenAI Python SDK speaks the OpenAI-compatible
chat-completions protocol, which Qwen, WaveSpeed, DashScope, Together, etc.
all implement. The `base_url` setting points to the Qwen/WaveSpeed endpoint
and `model=qwen3.7-plus` is the routing key. **The actual model running is
Qwen3.7-Plus**, doing image OCR, classification, structured extraction, and
long-form generation in one provider.

### 11. Environment variable names

Spec names take precedence; legacy `LLM_*` names are still read as a
fallback so older `.env` files keep working.

| Spec | Legacy fallback |
|---|---|
| `QWEN_API_KEY` | `LLM_API_KEY` |
| `QWEN_API_BASE` | `LLM_BASE_URL` |
| `QWEN_MODEL` (new) | `LLM_MODEL` |
| `ALLOWED_ORIGINS` | `CORS_ORIGINS` |
| `JWT_SECRET` | — (used as session-secret salt) |
| `UPLOAD_DIR` | — |
| `SESSION_TTL_HOURS`, `RESET_TOKEN_TTL_MINUTES`, `COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `DEV_AUTH_EXPOSE_RESET_TOKEN` | — |

### 12. Folder layout: `app/...` instead of bare `main.py`

The spec lists files at the backend root (`main.py`, `config.py`, `db/`,
`auth/`, `letters/`). We use a single `app/` package for cleaner imports
(`from app.config import settings`). Functionally identical.

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── auth/         { __init__, utils, dependencies, router }
│   ├── routers/      { __init__, letters, actions, deadlines, rag }
│   ├── services/     { __init__, extraction, risk, storage, pdf_pages }
│   ├── pipeline/     { __init__, orchestrator }
│   └── rag/          { __init__, store, seed }
├── data/             # gitignored — sqlite + chroma
├── uploads/          # gitignored — letter files
├── docs/02-backend.md
├── requirements.txt
└── .env
```

### 13. Route prefixes

The spec uses `/api/auth/*`, `/api/letters/*`, `/api/deadlines/*`. All
implemented exactly. We additionally expose:

- `/api/actions` and `/api/actions/{id}` (PATCH) — covers the
  `UserCorrection` feedback loop and per-action status updates.
- `/api/rag/search` and `/api/rag/reseed` — internal RAG debug surface;
  all auth-gated.
- `/health` (unauthenticated) — liveness probe for Railway / Render.

---

End of modifications. If a deviation isn't listed above, it's a bug.

