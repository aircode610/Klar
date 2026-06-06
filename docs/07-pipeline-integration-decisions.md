# Klar — Pipeline Integration Decisions (Backend + AI Team + Frontend)

**Status:** authoritative reference for who-built-what and how the three pieces
combine. Read this first when working on the AI extraction / RAG / response
generation paths.

**Context:** the original 4-dev spec (Dev 1 frontend / Dev 2 backend / Dev 3
RAG / Dev 4 ReAct agent) split too late. Three artifacts emerged:
- The **backend** (`backend/app/`) — Nuriel, owning Dev 2 + collapsed Dev 3 + collapsed Dev 4 inline.
- The **AI team's modules** (`ai/`) — built to the original spec: OCR step,
  LangGraph ReAct agent with Tavily web search, RAG retrieval over real
  German law, structured generation with anti-hallucination prompting.
- The **frontend** (`frontend/`) — TypeScript + cookies, sync `POST /letters`
  preferred, no SSE per their `docs/06-frontend-integration-contract.md`.

This document records the final integration plan: which conflicts were
resolved which way, why, and what code lives where.

---

## TL;DR

Three teams, three sets of strengths, **nobody's work gets thrown away**:

- **Backend strengths kept**: cookie auth, all HTTP routes, multipart
  validation, schemas matching the frontend contract field-for-field,
  closed-enum `DocumentCategory`, deterministic 0-100 risk formula with
  `RiskBreakdown`, multi-action model, error envelope, SSE orchestrator,
  fast sync `POST /letters` via single vision Qwen call.
- **AI team's strengths adopted**: 120,845-line real German law corpus,
  ChromaDB-backed legal retrieval, anti-hallucination grounded response
  generator (`ai/rag/generator.py`), dedicated OCR (`ai/react_agent/ocr.py`)
  for high-quality `ocr_text`, LangGraph ReAct agent (`ai/react_agent/agent.py`)
  with Tavily web search for deadline lookups.
- **Frontend contract honored**: every conflict that pits our shape against
  theirs is resolved in favor of the frontend (closed enums, 0-100 scale,
  multi-action `actions[]`, `summary_en`/`detail` field names, etc.).

The integration runs in **two execution modes**:

1. **Fast sync path** — `POST /letters` runs our single vision Qwen call,
   gets a `PublicLetter` back in ~5 seconds, attaches real § citations from
   the AI team's legal corpus to the response. Frontend's current contract.
2. **Rich streaming path** — `GET /api/letters/{id}/process` (SSE) runs the
   AI team's full 4-step pipeline (OCR → ReAct agent → RAG retrieval →
   structured generation), emitting our typed SSE events as each stage
   completes. ~15-25s end-to-end but feels instantaneous because the user
   sees progress live. Frontend opts in per-screen.

Both modes share the same persistence model, same auth, same schemas, same
legal corpus.

---

## Decision matrix (29 rows, every conflict)

| # | Aspect | Frontend wants | We built | AI team built | DECISION | Why |
|---|---|---|---|---|---|---|
| 1 | Auth (cookie sessions) | HttpOnly cookies, `credentials: 'include'`, signup/login/logout | ✅ all of it | — | OURS | only player |
| 2 | Root + `/api/*` routes | 6 root + 4 auth | ✅ all + 16 `/api/*` extras | — | OURS | only player |
| 3 | Error envelope | `{detail}` strings | `{code, message, detail, details}` (alias wired) | — | OURS | wire-compat both ways |
| 4 | Multipart upload + magic-bytes + multi-page PDF | accept JPEG/PNG/HEIC/WebP/PDF | ✅ + magic-bytes anti-spoof, 10 MB cap, pdf2image | path-only API | OURS | more robust at the HTTP edge |
| 5 | OCR (image → German text) | doesn't care how, wants `ocr_text` | byproduct of vision Qwen call | dedicated `qwen-vl-ocr` (`ai/react_agent/ocr.py`) | THEIRS for streaming pipeline; OURS for sync | their dedicated OCR yields cleaner text; ours is "free" in vision call |
| 6 | Letter classification — `category` (enum) | closed `DocumentCategory` (15 values) | enforced via function calling | free-text only | OURS | frontend uses it for UI icons, filtering, routing |
| 7 | Letter classification — `document_type` (display string) | German doc name | "Beitragsrechnung" | "Health Insurance – Tax ID Request" (richer) | THEIRS | better human-readable display |
| 8 | Action granularity | `actions[]`, multiple per letter | ✅ multi-action `ActionItem` table | one `AgentAnalysis` per letter (single deadline/consequence) | OURS | real Mahnungen have 2–3 obligations |
| 9 | Severity per action | `critical \| high \| medium \| low` | ✅ 4-value enum | their `RiskScore` is letter-level 1-5 (different concept) | OURS | matches frontend; their concept is different |
| 10 | Risk score scale | 0-100 + `RiskBreakdown` | ✅ deterministic 5-component formula | LLM-assigned 1-5 + label + reason | OURS | frontend needs the breakdown; ours is reproducible |
| 11 | Risk score *source* | doesn't say; gives them `RiskBreakdown` | formula (PRD §4.5) | LLM (variable per call) | OURS | reproducible across UI edits |
| 12 | Deadline extraction strategy | `deadline_confidence` + `deadline_source` | vision call returns all three | 3-step: read → calculate → Tavily web search | THEIRS for streaming (Tavily fallback enabled); OURS for sync | their Tavily can rescue unknown deadlines; ours is faster |
| 13 | `evidence_span` per action | yes, German verbatim quote | ✅ in extraction prompt | n/a | OURS | hallucination defense, frontend uses it |
| 14 | Reply / response generation | `POST /letters/{id}/reply` → `ReplyDraft` (German Behördendeutsch) | basic Qwen call, no grounding | `ai/rag/generator.py` with anti-hallucination + real § citations | THEIRS | grounded generation is dramatically better |
| 15 | Explanation (long-form prose) | yes | streamed via Qwen, freeform | structured grounded | THEIRS for quality | their anti-hallucination prompt + § grounding wins |
| 16 | Checklist | `items[]` of strings | separate Qwen call | part of `GenerationOutput` (same context) | THEIRS | already in the grounded call; no extra LLM hit |
| 17 | Citations on `/reply` and `/rag/search` | real `§` with `section`/`law` metadata | RAG hits from 27 hand-curated entries | real § from 120k lines of German law | THEIRS | demo-changing quality gap |
| 18 | Legal corpus | n/a (uses via `/rag/search`) | 27 hand-curated entries | **120,845 lines** of AufenthG/SGB V/EStG/BMG/VwVfG/BAföG/OWiG/AsylG/IntV/BeschV/AsylBLG/AufenthV/WoGG | THEIRS | no contest |
| 19 | Vector store path | n/a | `data/chroma/` | `ai/data/chroma/` | THEIRS (we point at it) | has real content |
| 20 | Web search (Tavily) | not in contract | none | LangGraph agent + `langchain-tavily`, max 2/letter | THEIRS (used in SSE pipeline only) | pure upside; "Klar searched online for the deadline" demo moment |
| 21 | Schemas exposed to frontend | `PublicLetter`, `PublicAction`, `RiskBreakdown`, `ReplyDraft`, etc. | ✅ aligned to contract | `AgentAnalysis`, `GenerationOutput`, `LegalChunk` (different) | OURS as wire format; translate THEIRS via adapters | frontend already typed against ours |
| 22 | Streaming (`GET /api/letters/{id}/process` SSE) | declined; wants sync `POST /letters` | ✅ orchestrator + 10 event types | naturally fits multi-stage | OURS chassis + THEIRS engine | their multi-stage maps 1:1 onto our event sequence |
| 23 | Sync `POST /letters` | yes | ✅ via our vision call | — | OURS | keep the fast path; ~5s |
| 24 | Multi-language output | en, de, fa, tr, ar, uk | ✅ all 6 | en, de, tr, ar, es, fr, zh, fa | OURS | matches frontend's exact list |
| 25 | `UserCorrection` feedback loop | `PATCH /actions/{id}` persists | ✅ logs every field change | — | OURS | only player |
| 26 | `Letter.confidence` (overall) | yes (drives "get a human" prompt at <0.85) | ✅ min of category + language signals | — | OURS | built, frontend already uses |
| 27 | `Letter.ocr_text` field | yes (verbatim German) | ✅ stored | dedicated OCR step | OURS field, populated by THEIRS in SSE path | field structure ours; content from their OCR when SSE pipeline runs |
| 28 | Risk breakdown explanation | yes | ✅ computed by formula | n/a (their 1-5 has free-form "reason") | OURS | reproducible, formula-derived |
| 29 | Two-step upload / process flow | sync only per frontend contract | ✅ both (`/upload` + `/process`) | — | OURS | keep both surfaces |

---

## Section 1 — Auth, HTTP surface, error envelope (rows 1–3)

**Decision: keep everything in the backend.** Frontend explicitly aligned
their contract on cookie auth (their PR `7cd0a66 docs(frontend): cookie
auth + new feature contract`). Every auth route, both at root (`/auth/*`)
and under `/api/auth/*`, lives in `app/auth/`. The error envelope wraps
every non-2xx response in `{code, message, detail, details}` — the
`detail` alias is wire-compatible with clients reading FastAPI's default
shape (the frontend team's contract uses this form), while sophisticated
clients can switch on `code`.

**Action items:** none. Already done.

---

## Section 2 — File handling (row 4)

**Decision: keep ours.** The AI team's modules accept a `path: str` — they
expect the HTTP layer to have already validated the file. We do:

- Magic-bytes inspection against the declared `Content-Type` — defends
  against `evil.exe` renamed `image.jpg` (returns `LETTER_MIME_MISMATCH`).
- 10 MB cap (frontend contract).
- Atomic disk write via tempfile + rename to `uploads/{user_id}/{letter_id}.{ext}`.
- Multi-page PDF rendering via pdf2image (up to 12 pages at 200 DPI).

**Action items:** none. Already done.

---

## Section 3 — OCR (row 5)

**Conflict:** their `qwen-vl-ocr` is purpose-built for cleaner text
extraction; our vision call gets OCR as a byproduct of structured
extraction.

**Decision:**
- **Sync path (`POST /letters`):** use OUR vision call. The OCR is "free"
  as part of our single Qwen call, no extra latency.
- **Streaming path (`GET /api/letters/{id}/process` SSE):** use THEIR
  dedicated `ai.react_agent.ocr.extract_text_from_image()` as step 1. Yields
  cleaner German text, emit as `ocr_result` event (~3s).
- The `Letter.ocr_text` field structure stays ours; the content is sourced
  from whichever path ran.

**Action items:**
- In the SSE orchestrator, replace the inline `extract_from_letter_file()`
  call's OCR step with `ai.react_agent.ocr.extract_text_from_image(path)`.
- Emit `event: ocr_result` with their cleaner text.

---

## Section 4 — Classification (rows 6, 7)

**Conflict:** frontend wants a closed enum (`category`) AND a free-text
display string (`document_type`). Theirs is free-text-only; ours is
enum-enforced.

**Decision:** **both fields, sourced differently.**
- `category: DocumentCategory` (15-value enum) — OURS. Frontend needs the
  closed set for UI routing (icons per category, category filters in `GET
  /actions`, etc.).
- `document_type: str` (free-form display string) — THEIRS where their
  pipeline runs. Their classifier produces richer strings like "Health
  Insurance – Tax ID Request" which read better than our raw German
  "Beitragsrechnung". In the sync path we keep ours; in SSE we use theirs.

**Action items:**
- After their ReAct agent returns `Classification {type, agency}`, write
  `type` straight into `Letter.document_type`.
- Map their free-text `type` to our 15-value enum via a small post-classifier
  rule (substring match: "Residence Permit" → `immigration`, "Health
  Insurance" → `health_insurance`, etc.). Default to `other` if unmatched.

---

## Section 5 — Action granularity (row 8)

**Conflict:** they give one `AgentAnalysis` per letter (one deadline, one
consequence). Frontend wants `actions[]` because real letters often have
2-3 obligations.

**Decision: keep OURS.** Wrap their single `AgentAnalysis` as ONE
`ActionItem` in the SSE pipeline. Note this as a quality limitation of the
SSE path — if a Brief has multiple obligations, only the most prominent
one surfaces.

**Sync path is unaffected** — our vision call already extracts multiple
actions per letter.

**Action items:**
- In SSE orchestrator, after their agent runs, create ONE `ActionItem` with
  fields populated from their `AgentAnalysis.deadline`, `.consequence`, and
  the consequence text as `description`.
- Document this in the SSE pipeline docstring so future work knows the
  limitation.

---

## Section 6 — Severity & risk score (rows 9, 10, 11, 28)

**Conflict:** they emit `RiskScore { score: 1..5, label, reason }`.
Frontend wants `risk_score: 0..100 + RiskBreakdown {5 weighted components}`.

**Decision: keep OURS, ignore theirs.** Frontend explicitly types against
our 0-100 + breakdown shape. Their 1-5 LLM-assigned score doesn't carry the
breakdown structure and isn't reproducible across UI edits.

In the SSE pipeline:
- Take their `AgentAnalysis.deadline.date` and `.consequence` text.
- Use them as inputs to OUR `compute_risk(action, institution)` formula
  (PRD §4.5) which produces the proper 0-100 + breakdown.
- Discard their 1-5 score entirely.

The action's `severity` enum (`critical|high|medium|low`) is also OURS —
we map it via a small heuristic on their `RiskScore.label`:

```python
SEVERITY_FROM_LABEL = {
    "Critical":      Severity.CRITICAL,
    "High":          Severity.HIGH,
    "Medium":        Severity.MEDIUM,
    "Low":           Severity.LOW,
    "Informational": Severity.LOW,
}
```

**Action items:**
- In SSE orchestrator, after their agent runs, immediately call our
  `compute_risk()` on the wrapped action — discard their `RiskScore`.
- Map their `RiskScore.label` to our `Severity` enum via the table above.

---

## Section 7 — Deadline extraction (row 12)

**Conflict:** their agent uses Tavily web search as fallback when the
letter has no explicit date. Ours doesn't.

**Decision:**
- **Sync path:** keep OURS (single vision call, ~5s, returns
  `deadline_iso`, `deadline_confidence`, `deadline_source`).
- **Streaming path:** use THEIRS (LangGraph ReAct + Tavily). Their 3-step
  approach (read → calculate from letter date → web search) catches more
  edge cases.

Their `Deadline.source` enum is `letter | calculated | searched | none`
which is richer than our `explicit | inferred | unknown`. Map both ways:

| Theirs | Ours |
|---|---|
| `letter` | `explicit` |
| `calculated` | `inferred` |
| `searched` | `inferred` (carry a flag to surface "We searched online") |
| `none` | `unknown` |

**Action items:**
- Set `TAVILY_API_KEY` in `.env.example` (and document optional).
- In SSE orchestrator, take their `Deadline.date` + `.source` and map both
  to our schema.
- For UI: when source was `searched`, surface a small badge on the action
  ("We looked this up online for you") — but that's a frontend concern.

---

## Section 8 — Evidence span (row 13)

**Decision: keep OURS.** Frontend needs the German verbatim quote on every
action as a hallucination-defense feature. Their pipeline doesn't produce
this field. In the SSE pipeline, we extract `evidence_span` from the OCR
text using a simple heuristic: search the OCR for the deadline phrase
(date / "innerhalb von 14 Tagen" / etc.), grab the containing sentence.

**Action items:**
- After their agent returns, run a small Python function on the OCR text +
  agent's deadline to locate the sentence that mentions the date.
- Fall back to `evidence_span = ""` if no match.

---

## Section 9 — Reply / response generation (row 14)

**Conflict:** ours is a basic Qwen call with no grounding. Theirs has an
anti-hallucination prompt that explicitly forbids citing § paragraphs not
in the retrieved corpus.

**Decision: use THEIRS (`ai.rag.generator.generate_response()`).** Their
grounded generator is dramatically better quality and matches the
frontend contract's `ReplyDraft` shape after mapping.

The mapping:
- Their `GenerationOutput.response_draft` → our `ReplyDraft.body_text`
- `language` stays `"de"` (their generator already produces German)
- `download_url` stays `null` (frontend renders client-side)

For `POST /letters/{id}/reply` we need to build a synthetic `AgentResult`
from the persisted `Letter` + `ActionItem` rows:

```python
agent_result = AgentResult(
    ocr_text=letter.ocr_text,
    letter_type=letter.document_type,
    agency=letter.institution,
    deadline_date=letter.deadline_date.isoformat() if letter.deadline_date else None,
    days_remaining=(letter.deadline_date - date.today()).days if letter.deadline_date else None,
    consequence=letter.consequence,
    risk_score=letter.risk_score,
    risk_label=label_from_risk_score(letter.risk_score),  # 0-100 → "Critical"|"High"|...
)
```

**Action items:**
- Replace `generate_reply_text` call in `app/routers/public.py::generate_reply`
  with a call to `ai.rag.generator.generate_response()`.
- Add the `AgentResult` synthesizer helper.
- Pull citations from `ai.rag.retrieval.retrieve_legal_context()` first,
  pass them to the generator (or rely on their generator's internal
  retrieval — confirm in their code).

---

## Section 10 — Long-form fields: explanation, checklist (rows 15, 16)

**Decision: use THEIRS.** Same grounded generator produces these as
fields in `GenerationOutput`:
- `GenerationOutput.explanation` → `Letter.explanation`
- `GenerationOutput.checklist` (already a list of strings) → `Letter.checklist`

For the SSE pipeline, we chunk their `explanation` string on our side
(split by sentence) and emit as `event: explanation` events to preserve
the streaming UX. Frontend appends as chunks arrive.

**Action items:**
- After their generator returns, persist `explanation` + `checklist` on
  the Letter row.
- In SSE pipeline, split explanation into ~10-word chunks and emit one
  event per chunk with a tiny sleep between them for visual pacing.

---

## Section 11 — Citations (row 17)

**Decision: use THEIRS.** Their `Citation { section, text }` objects come
from grounded retrieval over real laws. We store them in
`Letter.citations` (already a JSON column on the model) and surface them:
- In SSE pipeline: `event: citations` carries the list.
- In sync `POST /letters` and `GET /letters/{id}`: include the persisted
  `citations` field in the `PublicLetter` response.

Shape mapping (their `Citation` → frontend's `SSECitationItem`):

```python
{
  "section": citation.section,   # "§ 81 Abs. 4 AufenthG"
  "text": citation.text,         # German legal text excerpt
  "score": 1.0,                  # they don't compute one
}
```

**Action items:**
- Add `citations: list[Citation]` field projection on `PublicLetter` (it's
  already in the Letter model, just expose it).
- Wire through to SSE.

---

## Section 12 — RAG corpus and `/rag/search` (rows 18, 19)

**Decision: use THEIRS entirely.** Their 120,845-line corpus + ChromaDB at
`ai/data/chroma/` replaces our `data/chroma/` for the `/rag/search`
endpoint.

In `app/routers/public.py::rag_search_public` and `app/routers/rag.py`:

```python
# Replace our store.search() with their retrieval:
from ai.rag.retrieval import retrieve_legal_context

chunks = retrieve_legal_context(
    ocr_text=payload.query,
    letter_type=payload.institution or "",
    top_k=payload.top_k,
)
hits = [
    RagHit(
        text=c.text,
        score=1.0,  # they don't return scores
        metadata={"section": c.section, "law": c.law, "title": c.title, "citation": c.citation},
    )
    for c in chunks
]
```

**Action items:**
- `python ai/rag/ingest.py` once to build their ChromaDB.
- Swap `store.search()` calls in `/rag/search` to `retrieve_legal_context()`.
- Keep `app/rag/store.py` available for internal extraction-time grounding
  only (not exposed via HTTP).

---

## Section 13 — Tavily web search (row 20)

**Decision: keep THEIRS, used only in the SSE pipeline.** Their agent
handles Tavily internally; we just need `TAVILY_API_KEY` set in the
environment. If the key isn't set, their `langchain-tavily` tool errors
gracefully and the agent skips the web search step.

**Action items:**
- Add `TAVILY_API_KEY` to `.env.example` with a comment that it's optional.
- Document in README that Tavily enables the "we searched online" UX.

---

## Section 14 — Schemas (row 21)

**Decision: OUR schemas are the wire format.** Their schemas
(`AgentAnalysis`, `GenerationOutput`, `LegalChunk`) live inside the AI
team's modules and are *internal* — we never serialize them over HTTP. At
the integration boundary we map them to our `PublicLetter` / `PublicAction`
/ `ReplyDraft` / `RiskBreakdown` / `RagHit` shapes.

This isolation matters because the frontend has TypeScript types generated
from our OpenAPI spec. If we exposed their shapes we'd break the frontend's
type-checked code.

**Action items:**
- All AI-team-side adapters live in a single new file: `app/services/ai_bridge.py`.
- The bridge module handles all `AgentAnalysis → PublicAction`, `GenerationOutput → ReplyDraft`, `LegalChunk → RagHit` translations.

---

## Section 15 — Streaming pipeline (rows 22, 23, 29)

**Decision: BOTH execution modes preserved.**

```
Sync path: POST /letters
  └─► our vision Qwen call (~5s)
  └─► attach legal citations from ai.rag.retrieval (~1s extra)
  └─► return PublicLetter inline

Streaming path: GET /api/letters/{id}/process (SSE)
  ├─► ai.react_agent.ocr (~3s)            → event: ocr_result
  ├─► ai.react_agent.agent (~5-15s)       → events: classification, risk_score, deadline, consequence
  ├─► ai.rag.retrieval (internal, <1s)    → (no event)
  ├─► ai.rag.generator (~5-10s)           → events: explanation chunks, response_draft chunks, checklist, citations
  └─► persist all fields → event: done
```

The sync path is what the frontend's current contract uses. The streaming
path is opt-in for screens that want the live-progress UX. **Both share
the same DB schema, same auth, same legal corpus, same final
`PublicLetter` shape after retrieval.**

**Action items:**
- Replace the contents of `process_letter_stream()` in
  `app/pipeline/orchestrator.py` with the 4-step chain above.
- Add the sync-path citation enrichment in `app/routers/public.py::post_letter()`.

---

## Section 16 — Localization (row 24)

**Decision: OUR language list (en, de, fa, tr, ar, uk).** Theirs has
extras (es, fr, zh) but frontend doesn't use them. Pass `?lang=` down to
both pipelines:
- Sync: into our vision system prompt
- Streaming: into `ai.rag.generator.generate_response(language=lang)` —
  their LANGUAGE_NAMES dict covers all our 6.

**Action items:** none. Already aligned.

---

## Section 17 — Persistence model (rows 25, 26, 27)

**Decision: keep OURS entirely.** Our SQLite schema (PRD §7) supports
everything:
- `Letter`: holds `ocr_text`, `confidence`, `explanation`, `response_draft`,
  `checklist` (JSON), `citations` (JSON), `consequence`, `risk_score`,
  `deadline_date`, etc.
- `ActionItem`: per-obligation rows.
- `RiskScore`: deterministic formula breakdown per action.
- `UserCorrection`: every PATCH-edited field, audit log + future
  prompt-tuning dataset.

**Action items:** none.

---

## Implementation phases

### Phase 1 — Make `ai/` importable + run ingest (~20 min)

```fish
# Add deps
echo "langchain-openai>=0.2.0
langchain-tavily>=0.1.0
langgraph>=0.2.0
langchain>=0.3.0" >> backend/requirements.txt

cd backend && .venv/bin/pip install -r requirements.txt

# Build the corpus
cd .. && python ai/rag/ingest.py
# Should write to ai/data/chroma/ — silently, ~2-5 min
```

Smoke test:
```fish
.venv/bin/python -c "
from ai.rag.retrieval import retrieve_legal_context
chunks = retrieve_legal_context('Aufenthaltstitel Frist Nachreichung', 'Aufenthaltstitel', top_k=3)
for c in chunks:
    print(c.section, c.law, '—', c.text[:80])
"
```

### Phase 2 — Build the AI-bridge adapter module (~30 min)

Create `backend/app/services/ai_bridge.py` with:
- `synthesize_agent_result(letter, action) → AgentResult`
- `map_classification_to_category(free_text) → DocumentCategory`
- `map_their_severity_label(label) → Severity`
- `map_their_deadline_source(source) → DeadlineSource`
- `legal_chunk_to_rag_hit(chunk) → RagHit`
- `citation_to_dict(citation) → dict` (for JSON storage)

### Phase 3 — Swap `/rag/search` to their corpus (~15 min)

Edit `app/routers/public.py` and `app/routers/rag.py`. Replace
`store.search()` with `retrieve_legal_context()` + adapter.

### Phase 4 — Swap `/reply` to their grounded generator (~30 min)

Edit `app/routers/public.py::generate_reply()`. Replace
`generate_reply_text()` with `ai.rag.generator.generate_response()` after
synthesizing an `AgentResult`. Persist `explanation`/`checklist`/`citations`
on the Letter.

### Phase 5 — Rewire SSE orchestrator (~45 min)

Edit `app/pipeline/orchestrator.py::process_letter_stream()`. Replace the
single `extract_from_letter_file()` call with the 4-step chain. Use
adapters for all schema translations.

### Phase 6 — Test, commit, document (~30 min)

- Smoke test sync `POST /letters` — confirm `citations` populated.
- Smoke test SSE `GET /process` — confirm all 10 event types arrive in order.
- Smoke test `POST /letters/{id}/reply` — confirm German body_text + real § citations.
- Regen `postman/openapi.json` + Posting collection.
- Commit + push.

---

## What to communicate to each team

### To the frontend team
> Cookie auth aligned to your contract. The sync `POST /letters` works as
> spec'd and now also returns real `§` legal citations (from a 120k-line
> German law corpus, courtesy of the AI team). When you're ready for the
> demo wow moment, opt into `GET /api/letters/{id}/process` (SSE) on the
> processing screen — same JSON shapes, just live-streamed.

### To the AI team
> Your work isn't going to waste — your OCR module, your ReAct agent
> (Tavily included), your RAG corpus + retrieval, and your grounded
> generator are all wired into the SSE streaming pipeline. Schemas at the
> HTTP boundary stay backend-shaped to match the frontend's TS types, but
> every model call along the way is yours. Run `python ai/rag/ingest.py`
> once before the backend starts.

### To anyone reading this doc later
> The triple-collision was real. Resolution favored: (1) frontend
> contract on shapes, (2) backend on auth/HTTP/persistence/schemas/risk
> formula, (3) AI team on OCR-quality, German legal corpus, grounded
> generation. Read the decision matrix at the top to find which side won
> for any specific concern.

---

## File ownership after integration

| Path | Owner | Purpose |
|---|---|---|
| `backend/app/*` | Backend (Nuriel) | HTTP layer, schemas, persistence, auth, error envelope, sync extraction, SSE chassis |
| `backend/app/services/ai_bridge.py` | Backend (new) | All AI-team schema adapters |
| `backend/app/pipeline/orchestrator.py` | Backend (updated) | SSE engine — calls AI team's modules |
| `backend/app/routers/public.py` | Backend (updated) | `/reply` calls their generator; `/rag/search` calls their retrieval |
| `backend/app/services/extraction.py` | Backend | Sync vision path (untouched) |
| `backend/app/rag/store.py`, `seed.py` | Backend | Internal extraction-time grounding only |
| `ai/react_agent/ocr.py` | AI team | Step 1 of SSE pipeline |
| `ai/react_agent/agent.py` | AI team | Step 2 of SSE pipeline (LangGraph + Tavily) |
| `ai/rag/ingest.py` | AI team | Run once at setup |
| `ai/rag/retrieval.py` | AI team | Called by `/rag/search` and sync citation enrichment |
| `ai/rag/generator.py` | AI team | Called by `/reply` and SSE pipeline (steps 3-4) |
| `ai/data/laws/*` | AI team | Source corpus |
| `ai/data/chroma/` | AI team | Vector store |
| `frontend/*` | Frontend team | Client app |
| `docs/06-frontend-integration-contract.md` | Frontend team | Wire contract |
| `docs/06-api-contract.md` | Backend (Nuriel) | Backend's wire contract |
| `docs/07-pipeline-integration-decisions.md` | Backend (this doc) | Integration source of truth |
