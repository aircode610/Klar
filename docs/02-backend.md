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
