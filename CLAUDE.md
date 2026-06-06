# Klar — AI Agent Instructions

## Project Overview

Klar is a bureaucracy survival agent for internationals in Germany. Users upload official German letters — Klar explains them, flags deadlines and consequences, and drafts the response in Behördendeutsch.

**Build type:** 6-hour hackathon prototype, 4 developers
**Strategic wedge:** Narrow (immigration/student bureaucracy) + Acts (drafts responses)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + TypeScript + React + PWA (next-pwa) |
| Backend | Python FastAPI + SQLite + aiosqlite |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| AI / OCR | Qwen-VL (sponsor-provided API) |
| AI / LLM | Qwen text model (sponsor-provided API) |
| AI / Agent | ReAct agent (Qwen + DuckDuckGo web search) |
| AI / RAG | ChromaDB + Qwen embeddings + German legal texts |
| Frontend deploy | Vercel |
| Backend deploy | Railway or Render |

## Documentation

Read these before writing any code:

### Specs (what to build)
- `docs/00-roadmap.md` — Architecture, tech stack, system overview
- `docs/01-frontend.md` — Pages, components, SSE client, PWA, styling
- `docs/02-backend.md` — API endpoints, data model, auth, SSE streaming protocol
- `docs/03-ai-react-agent.md` — Qwen-VL OCR, ReAct agent loop, classification prompts
- `docs/04-ai-rag-pipeline.md` — ChromaDB, legal text ingestion, response generation
- `docs/05-developer-assignments.md` — Team split, 6-hour timeline, integration contracts

### Implementation Plans (how to build it, step by step)
- `docs/plans/2026-06-06-frontend.md` — Dev 1: Next.js frontend, 6 tasks
- `docs/plans/2026-06-06-backend.md` — Dev 2: FastAPI backend, 6 tasks
- `docs/plans/2026-06-06-ai-react-agent.md` — Dev 4: OCR + ReAct agent, 6 tasks
- `docs/plans/2026-06-06-ai-rag-pipeline.md` — Dev 3: RAG pipeline, 6 tasks

## Repo Structure

```
Klar/
├── frontend/                # Dev 1 — Next.js app
│   ├── src/app/             # App router pages
│   ├── src/components/      # React components
│   └── src/lib/             # API client, auth helpers, constants
├── backend/                 # Dev 2 — FastAPI app
│   ├── auth/                # Signup, login, JWT
│   ├── letters/             # Upload, CRUD
│   ├── deadlines/           # Deadline tracking
│   ├── pipeline/            # SSE orchestrator
│   └── db/                  # SQLite schema, connection
├── ai/                      # Dev 3 + Dev 4 — AI modules
│   ├── react_agent/         # Dev 4: OCR, search tool, ReAct agent
│   ├── rag/                 # Dev 3: ingestion, retrieval, generation
│   └── data/                # Legal texts + ChromaDB storage
└── docs/                    # Specs + plans
```

## Integration Contracts

These interfaces are the handoff points between developers. Do not change signatures without coordinating.

### Dev 4 → Backend (ReAct Agent)
```python
async def extract_text_from_image(image_path: str) -> str
async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]
# AgentEvent.type: "classification", "risk_score", "deadline", "consequence"
```

### Dev 4 → Dev 3 (AgentResult)
```python
@dataclass
class AgentResult:
    ocr_text: str
    letter_type: str
    agency: str
    deadline_date: str | None
    days_remaining: int | None
    consequence: str
    risk_score: int
    risk_label: str
```

### Dev 3 → Backend (RAG Pipeline)
```python
async def run_rag_pipeline(ocr_text: str, agent_result: AgentResult, language: str) -> AsyncGenerator[RAGEvent, None]
# RAGEvent.type: "explanation", "response_draft", "checklist", "citations"
```

### Backend → Frontend (SSE)
```
GET /api/letters/{id}/process?token=JWT&lang=en
Events: ocr_result, classification, risk_score, deadline, consequence,
        explanation, response_draft, checklist, citations, done, error
```

## Key Rules

- **Qwen models only** — Qwen is the hackathon sponsor. Use Qwen-VL for OCR, Qwen text for LLM, Qwen embeddings for RAG. Maximizing Qwen usage earns bonus points.
- **SSE, not WebSockets** — The streaming protocol uses Server-Sent Events (FastAPI StreamingResponse + browser EventSource). EventSource does NOT support custom headers, so JWT is passed as a query param `?token=`.
- **Language via query param** — The user's language preference is passed as `?lang=en` on the SSE endpoint. Do not use Accept-Language headers.
- **SQLite stores JSON as TEXT** — The `checklist` and `citations` columns are TEXT containing JSON strings. Serialize with `json.dumps()`, deserialize with `json.loads()`.
- **Each dev works in their own directory** — Frontend in `frontend/`, backend in `backend/`, AI in `ai/`. This minimizes git conflicts since everyone pushes to `main`.
- **Mock-first backend** — Dev 2 builds the SSE pipeline with mock AI functions first (already included in the plan). Dev 3 and Dev 4 replace mocks with real implementations when ready.
- **Fallbacks everywhere** — Search tool has a try/except fallback. RAG has a low-confidence fallback for out-of-scope letter types. The demo must never crash.

## Environment Variables

```
JWT_SECRET=<random-secret>
QWEN_API_KEY=<sponsor-provided>
QWEN_API_BASE=<sponsor-provided>
DATABASE_PATH=data/klar.db
UPLOAD_DIR=uploads
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```
