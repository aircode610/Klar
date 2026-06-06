# Klar — Project Roadmap

**German bureaucracy, finally klar.**

A bureaucracy survival agent for internationals in Germany. Upload any official German letter — Klar explains what it means, flags the deadline and consequence of missing it, and drafts the response you need to send back.

---

## Strategic Position

**Wedge:** Narrow (immigration / student bureaucracy) + Acts (drafts responses) — the empty quadrant competitors don't occupy.

**Competitors** (Admina, Bureaucracy Buddy, DocuPilot, mika, Ridocu) all cluster in broad + explain-only. Klar differentiates by actually producing the artifact: the cover letter, the document checklist, the ready-to-send response.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + TypeScript + React |
| PWA | next-pwa (service worker, manifest, offline page) |
| Backend | Python FastAPI |
| Auth | JWT (python-jose) + bcrypt |
| Database | SQLite |
| Vector Store | ChromaDB |
| AI / OCR | Qwen-VL (vision-language model, sponsor API) |
| AI / LLM | Qwen text model (sponsor API) |
| AI / Agent | ReAct agent (Qwen + web search tool) |
| AI / RAG | ChromaDB + Qwen embeddings + German legal texts |
| Web Search | Tavily or DuckDuckGo (for ReAct agent) |
| Frontend Hosting | Vercel (free tier) |
| Backend Hosting | Railway or Render (free tier) |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│               CLIENT — Next.js (TypeScript)               │
│  React + TypeScript + PWA (next-pwa)                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────────────┐ │
│  │  Upload   │ │  Auth    │ │   Results (SSE stream)    │ │
│  │(img/pdf/  │ │(login/   │ │ ┌─────┐ ┌─────┐ ┌─────┐ │ │
│  │ camera)   │ │ signup)  │ │ │ OCR │ │Expl.│ │Resp.│ │ │
│  └────┬──────┘ └──────────┘ └───────────────────────────┘ │
│  Deployed on: Vercel                                      │
└───────┼──────────────────────────────────────────────────┘
        │ POST upload → SSE stream back
┌───────▼──────────────────────────────────────────────────┐
│               BACKEND — FastAPI (Python)                  │
│  Deployed on: Railway / Render                            │
│                                                           │
│  ┌───────────────── AI PIPELINE ────────────────────┐     │
│  │                                                   │     │
│  │  Step 1: Qwen-VL OCR → extract text from image    │     │
│  │              ↓ stream "ocr_result"                 │     │
│  │  Step 2: ReAct Agent (Qwen + Web Search tool)     │     │
│  │           → classify letter type                   │     │
│  │           → find current rules/deadlines           │     │
│  │           → determine consequences                 │     │
│  │              ↓ stream "classification", "deadline", │     │
│  │                       "consequence"                │     │
│  │  Step 3: ChromaDB RAG                              │     │
│  │           → retrieve relevant § paragraphs         │     │
│  │              ↓ (internal, feeds into Step 4)       │     │
│  │  Step 4: Qwen LLM (with RAG context)              │     │
│  │           → explanation in user's language         │     │
│  │           → response draft in Behördendeutsch      │     │
│  │           → document checklist                     │     │
│  │           → § citations                            │     │
│  │              ↓ stream "explanation", "response",   │     │
│  │                       "checklist", "citations"     │     │
│  └───────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────┐  ┌───────────┐  ┌─────────────────┐        │
│  │  SQLite   │  │ ChromaDB  │  │ Web Search API  │        │
│  │(users,    │  │(§ legal   │  │ (for ReAct      │        │
│  │ letters,  │  │ embeddings│  │  agent tool)     │        │
│  │ deadlines)│  │)          │  │                  │        │
│  └──────────┘  └───────────┘  └─────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

---

## Core User Flow

1. User signs up / logs in
2. Uploads a German official letter (image, PDF, or camera capture)
3. Klar streams results in real time via SSE:
   - Extracted text (OCR)
   - Letter type classification
   - Risk score (1-5) with color coding
   - Deadline with countdown
   - Consequence of missing the deadline
   - Plain-language explanation (in user's chosen language)
   - Response draft (in Behördendeutsch)
   - Document checklist
   - § legal citations
4. User can copy/download the response, check off documents, track deadlines
5. Dashboard shows all processed letters sorted by deadline urgency

---

## Key Differentiators

1. **Response Generator** — Drafts the actual reply in Behördendeutsch. Competitors stop at "here's what to do."
2. **Consequence Engine** — "Miss this and your permit is rejected; re-apply in 6-8 weeks." Not just "deadline: March 14."
3. **§ Source Grounding** — Every legal claim cites the actual paragraph of law via RAG. Kills hallucination fear.
4. **Multi-language** — Explanations in user's language, responses always in German.

---

## Team & Timeline

| Role | Scope |
|------|-------|
| Dev 1 — Frontend | Next.js + TypeScript, all pages, SSE client, PWA, deploy to Vercel |
| Dev 2 — Backend | FastAPI, auth, DB, file handling, SSE orchestration, deploy to Railway |
| Dev 3 — AI: RAG | ChromaDB, legal text ingestion, embeddings, response generation prompts |
| Dev 4 — AI: ReAct | Qwen-VL OCR, ReAct agent loop, web search tool, classification prompts |

**Timeline: 6 hours.** See `05-developer-assignments.md` for the hour-by-hour breakdown.

---

## Documents Index

| Doc | Contents |
|-----|----------|
| `00-roadmap.md` | This file — overview, stack, architecture |
| `01-frontend.md` | Frontend spec: pages, components, SSE, PWA |
| `02-backend.md` | Backend spec: API, data model, auth, SSE |
| `03-ai-react-agent.md` | ReAct agent spec: OCR, classification, consequences |
| `04-ai-rag-pipeline.md` | RAG spec: legal KB, embeddings, response generation |
| `05-developer-assignments.md` | Per-dev assignments + 6-hour timeline |
