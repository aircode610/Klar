# Klar — Developer Assignments

**Team: 4 developers | Timeline: 6 hours | Goal: Hackathon demo**

---

## Team Roster

| Dev | Role | Owns | Spec Doc |
|-----|------|------|----------|
| Dev 1 | Frontend | Next.js + TypeScript, PWA, all UI, Vercel deploy | `01-frontend.md` |
| Dev 2 | Backend | FastAPI, auth, DB, SSE orchestration, Railway deploy | `02-backend.md` |
| Dev 3 | AI: RAG | ChromaDB, legal text ingestion, response generation | `04-ai-rag-pipeline.md` |
| Dev 4 | AI: ReAct | Qwen-VL OCR, ReAct agent, classification, search | `03-ai-react-agent.md` |

---

## Integration Contracts

These are the interfaces between devs. Agree on these before hour 1.

### Dev 4 → Dev 2 (ReAct Agent → Backend)

```python
# Dev 4 implements, Dev 2 calls
async def extract_text_from_image(image_path: str) -> str:
    """Qwen-VL OCR. Returns extracted text."""

async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]:
    """Yields: classification, risk_score, deadline, consequence events."""
```

### Dev 4 → Dev 3 (ReAct Agent → RAG Pipeline)

```python
# Dev 4 produces this, Dev 3 consumes it
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

### Dev 3 → Dev 2 (RAG Pipeline → Backend)

```python
# Dev 3 implements, Dev 2 calls
async def run_rag_pipeline(
    ocr_text: str,
    agent_result: AgentResult,
    language: str
) -> AsyncGenerator[RAGEvent, None]:
    """Yields: explanation, response_draft, checklist, citations events."""
```

### Dev 2 → Dev 1 (Backend → Frontend)

```
SSE endpoint: GET /api/letters/{id}/process?token=JWT
Events: ocr_result, classification, risk_score, deadline, consequence,
        explanation, response_draft, checklist, citations, done, error
```

---

## 6-Hour Timeline

### Hour 0-1 — Setup & Scaffolding

| Dev | Task | Deliverable |
|-----|------|------------|
| Dev 1 | Next.js project init, PWA config (`next-pwa`), layout shell, landing page, auth pages (login/signup forms) | Running Next.js dev server with basic pages |
| Dev 2 | FastAPI project init, SQLite schema creation, auth routes (signup/login), JWT middleware, CORS config | Running FastAPI server with working auth |
| Dev 3 | ChromaDB setup, download AufenthG full text, write chunking logic (split by §) | AufenthG chunked and ready |
| Dev 4 | Qwen-VL OCR integration — send a sample letter image to the API, get text back | Working OCR function tested with one letter |

**Sync point (end of hour 1):** Everyone confirms their scaffold runs. Dev 2 shares API base URL with Dev 1.

### Hour 1-2 — Core Features

| Dev | Task | Deliverable |
|-----|------|------------|
| Dev 1 | Upload page — drag-drop zone, file picker, camera capture (`getUserMedia`) | Working upload UI that sends file to backend |
| Dev 2 | File upload endpoint (multipart, PDF→image conversion), store file, return letter_id | `POST /api/letters/upload` working |
| Dev 3 | Embed AufenthG chunks via Qwen, store in ChromaDB, download + chunk AufenthV, test retrieval | ChromaDB populated with AufenthG, AufenthV in progress |
| Dev 4 | ReAct agent loop — implement think/act/observe cycle, integrate web search tool (DuckDuckGo or Tavily) | Agent can search the web and reason about results |

**Sync point (end of hour 2):** Dev 1 can upload a file to Dev 2's endpoint. Dev 4's OCR + agent loop works standalone.

### Hour 2-3 — Pipeline Integration

| Dev | Task | Deliverable |
|-----|------|------------|
| Dev 1 | Results page — SSE client (`EventSource`), progressive UI rendering for each event type | Results page shows streamed data |
| Dev 2 | SSE streaming endpoint — scaffold with mock data first, then wire in real AI functions | `GET /api/letters/{id}/process` streaming events |
| Dev 3 | Response generation prompt engineering — explanation, response draft, document checklist, § citations | `run_rag_pipeline()` function producing all outputs |
| Dev 4 | Classification + consequence prompt engineering — test with multiple letter types | Agent classifies correctly and produces structured output |

**Sync point (end of hour 3):** First end-to-end test. Upload a letter → see results stream in the browser (even if rough).

### Hour 3-4 — Complete Features

| Dev | Task | Deliverable |
|-----|------|------------|
| Dev 1 | Dashboard page (letter list + deadlines), language selector dropdown | All pages functional |
| Dev 2 | Letter CRUD endpoints, deadline endpoints, pipeline orchestrator wiring real AI functions | All API endpoints working |
| Dev 3 | Multi-language prompt templates, streaming implementation, § citation accuracy | RAG pipeline streams in user's language |
| Dev 4 | Risk scoring logic, deadline extraction from diverse formats, test edge cases | Agent handles diverse letter types |

**Sync point (end of hour 4):** Full pipeline works end-to-end with real AI. All pages exist. Core demo flow is functional.

### Hour 4-5 — Polish & Harden

| Dev | Task | Deliverable |
|-----|------|------------|
| Dev 1 | Responsive design, loading/error states, copy-to-clipboard, PWA icons/manifest | Polished, mobile-friendly UI |
| Dev 2 | Error handling across pipeline, edge cases (large files, timeout), response formatting | Robust backend that doesn't crash |
| Dev 3 | Full pipeline integration testing with backend, prompt tuning for quality | High-quality generated responses |
| Dev 4 | Integration with RAG (pass AgentResult), end-to-end testing through backend | ReAct + RAG working together seamlessly |

**Sync point (end of hour 5):** Everything works. Demo flow is smooth. No crashes.

### Hour 5-6 — Deploy & Demo Prep

| Dev | Task | Deliverable |
|-----|------|------------|
| Dev 1 | Deploy to Vercel, test with production backend URL, final UI tweaks | Live frontend at klar-app.vercel.app |
| Dev 2 | Deploy to Railway/Render, smoke test full flow, monitor for errors | Live backend API |
| Dev 3 | Final prompt tuning, test with demo letters, verify citation accuracy | Demo-ready AI responses |
| Dev 4 | Demo letter preparation (2-3 diverse letters), dry run of the demo flow | Ready-to-present demo |

**Final sync (hour 6):** Full dry run of the demo. Everyone watches the flow end-to-end.

---

## Communication Plan

- **Chat channel:** Create a shared channel (Slack/Discord/WhatsApp) for quick questions
- **Sync points:** Brief 2-minute standups at the end of hours 1, 2, 3, 4, 5
- **Blockers:** If blocked for >15 minutes, ping the group immediately — don't wait for the sync point
- **Integration:** Dev 2 is the integration hub. All AI functions flow through the backend. Dev 1 only talks to Dev 2's API.

---

## Critical Path

The longest dependency chain determines whether the demo works:

```
Dev 4: OCR → Agent → AgentResult
                         ↓
Dev 3: Legal KB → RAG → Response Generation (needs AgentResult)
                              ↓
Dev 2: SSE Orchestrator (needs both AI functions)
              ↓
Dev 1: Results UI (needs SSE endpoint)
```

**Risk mitigation:**
- Dev 2 should build the SSE endpoint with **mock data first** (hour 2) so Dev 1 can build against it immediately
- Dev 3 and Dev 4 work in parallel — they only need to integrate at hour 4
- If the ReAct agent is late, Dev 3 can test with a hardcoded `AgentResult`

---

## Repo Structure

```
Klar/
├── docs/                    # This documentation
├── frontend/                # Dev 1's Next.js app
│   ├── src/
│   │   ├── app/             # Next.js app router pages
│   │   ├── components/      # React components
│   │   └── lib/             # API client, SSE helpers
│   ├── public/              # PWA manifest, icons
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
├── backend/                 # Dev 2's FastAPI app
│   ├── main.py
│   ├── requirements.txt
│   ├── config.py
│   ├── db/
│   ├── auth/
│   ├── letters/
│   ├── deadlines/
│   └── pipeline/
├── ai/                      # Dev 3 + Dev 4's AI code
│   ├── react_agent/         # Dev 4
│   │   ├── ocr.py
│   │   ├── agent.py
│   │   ├── search.py
│   │   ├── prompts.py
│   │   └── schemas.py
│   ├── rag/                 # Dev 3
│   │   ├── ingest.py
│   │   ├── retrieval.py
│   │   ├── generator.py
│   │   ├── prompts.py
│   │   └── schemas.py
│   └── data/
│       ├── laws/            # Raw legal text files
│       └── chroma/          # ChromaDB storage
└── README.md
```

**Git workflow:** Everyone works on `main` (it's a 6-hour hackathon — branches add overhead). Communicate before pushing to avoid conflicts. The repo structure above minimizes file-level conflicts since each dev works in their own directory.
