# Klar — AI RAG Pipeline Spec

**Owner: Dev 3 (AI: RAG)**
**Stack: ChromaDB + Qwen Embeddings + Qwen LLM**
**Integration: Provides async generator functions called by Backend (Dev 2)**

---

## Responsibilities

Dev 3 owns two things:

1. **Legal Knowledge Base** — Download, chunk, embed, and store German legal texts in ChromaDB
2. **Response Generation** — Use RAG context + Qwen LLM to generate explanations, response drafts, checklists, and § citations

---

## 1. Legal Knowledge Base Setup

### Source Texts

Download and prepare these German laws (all publicly available at gesetze-im-internet.de):

| Law | Abbreviation | Relevance |
|-----|-------------|-----------|
| Aufenthaltsgesetz | AufenthG | Residence permits, visa, deportation |
| Aufenthaltsverordnung | AufenthV | Residence permit procedures |
| Beschäftigungsverordnung | BeschV | Work permits for foreigners |
| Freizügigkeitsgesetz/EU | FreizügG/EU | EU citizens' rights |
| Bundesausbildungsförderungsgesetz | BAföG | Student financial aid |
| Sozialgesetzbuch V | SGB V | Health insurance requirements |
| Einkommensteuergesetz | EStG | Tax basics (for Finanzamt letters) |
| Straßenverkehrsgesetz | StVG | Traffic fines |
| Ordnungswidrigkeitengesetz | OWiG | Administrative fines |

**For the hackathon:** Focus on AufenthG first (hour 0-1), then AufenthV (hour 1-2). Add SGB V and others as time permits.

**Fallback for out-of-scope letter types:** If a letter type doesn't match any ingested law (e.g., Finanzamt letter but EStG not yet ingested), the RAG retrieval will return low-relevance results. In this case, the generation prompt should instruct the LLM to rely on its own knowledge and clearly mark that no § citations were verified against source text. Add a `confidence` field to RAGEvent: `"high"` if RAG matched, `"low"` if no strong matches found.

### Download Process

```python
# Option 1: Scrape from gesetze-im-internet.de (public, official)
# Each law has a full-text page, e.g.:
# https://www.gesetze-im-internet.de/aufenthg_2004/

# Option 2: Use pre-formatted text files
# Many German laws are available as plain text or XML from the official site
```

### Chunking Strategy

Split each law into chunks at the paragraph (§) level:
- Each chunk = one § (paragraph) of the law
- Include the § number, title, and full text
- Keep subsections (Absätze) together within their parent §
- Typical chunk size: 200-800 tokens

**Chunk format:**
```
§ 81 Abs. 4 AufenthG — Beantragung des Aufenthaltstitels

Über die Vollständigkeit des Antrags [...full text...]
```

### Embedding

Use Qwen's embedding model (via the sponsor API) to convert each chunk to a vector.

```python
async def embed_text(text: str) -> list[float]:
    """Call Qwen embedding API, return vector."""
    response = await httpx.post(
        f"{QWEN_API_BASE}/embeddings",
        json={"input": text, "model": "text-embedding-v3"},
        headers={"Authorization": f"Bearer {QWEN_API_KEY}"}
    )
    return response.json()["data"][0]["embedding"]
```

**Note:** Check which embedding model the sponsor API provides. Common Qwen embedding models: `text-embedding-v1`, `text-embedding-v2`, `text-embedding-v3`.

### ChromaDB Storage

```python
import chromadb

client = chromadb.PersistentClient(path="data/chroma")
collection = client.get_or_create_collection(
    name="german_laws",
    metadata={"hnsw:space": "cosine"}
)

# Ingest all chunks
collection.add(
    ids=[f"{law}_{section}" for ...],
    documents=[chunk.text for chunk in chunks],
    metadatas=[{
        "law": "AufenthG",
        "section": "§ 81 Abs. 4",
        "title": "Beantragung des Aufenthaltstitels"
    } for chunk in chunks],
    embeddings=[chunk.embedding for chunk in chunks]
)
```

### Startup Script

Build an `ingest.py` script that:
1. Reads the law text files from a `data/laws/` directory
2. Chunks them by § paragraph
3. Embeds each chunk via Qwen API
4. Stores in ChromaDB

This runs ONCE before the demo (or on server startup). Takes a few minutes depending on the volume of text.

---

## 2. RAG Retrieval

### Query Process

Given the OCR text and the agent's classification:
1. Construct a search query from the letter content + classification
2. Query ChromaDB for top-K most relevant § paragraphs
3. Return the paragraphs as context for the LLM

```python
def retrieve_legal_context(
    ocr_text: str,
    letter_type: str,
    top_k: int = 5
) -> list[LegalChunk]:
    """Retrieve relevant § paragraphs from ChromaDB."""
    query = f"{letter_type}: {ocr_text[:500]}"  # Use classification + first 500 chars
    results = collection.query(
        query_texts=[query],
        n_results=top_k
    )
    return [
        LegalChunk(
            section=meta["section"],
            law=meta["law"],
            title=meta["title"],
            text=doc
        )
        for doc, meta in zip(results["documents"][0], results["metadatas"][0])
    ]
```

---

## 3. Response Generation

### Input

- `ocr_text` — the original letter text (from Dev 4's OCR)
- `agent_result` — classification, deadline, consequence, risk score (from Dev 4's ReAct agent)
- `legal_context` — retrieved § paragraphs (from RAG retrieval above)
- `language` — user's preferred language for explanations

### Generation Prompt Template

```
You are Klar, an expert assistant helping international students in Germany
understand and respond to official letters.

## The Letter
{ocr_text}

## Classification
Type: {agent_result.letter_type}
Agency: {agent_result.agency}
Deadline: {agent_result.deadline_date} ({agent_result.days_remaining} days remaining)
Risk: {agent_result.risk_score}/5 — {agent_result.risk_label}
Consequence: {agent_result.consequence}

## Relevant Legal References
{formatted_legal_context}

## Your Tasks

Generate the following four sections. Be precise, professional, and helpful.

### 1. EXPLANATION
Write a clear, plain-language explanation of this letter in {language}.
- What is this letter about?
- Who sent it and why?
- What action is required?
- What is the deadline?
- What happens if the deadline is missed?
Reference the relevant § paragraphs where appropriate.

### 2. RESPONSE DRAFT
Write a formal response letter in Behördendeutsch (official German) that the
user can send back to the agency. Include:
- Proper formal salutation and closing
- Reference number (Aktenzeichen) from the original letter
- Clear statement of what is being submitted/responded to
- Professional, bureaucratic tone matching what the agency expects

### 3. DOCUMENT CHECKLIST
List all documents the user needs to prepare or submit.
Format as a JSON array of strings.
Example: ["Proof of health insurance (Krankenversicherungsnachweis)", ...]

### 4. CITATIONS
List all § legal references you cited, with brief explanations.
Format as a JSON array of objects with "section" and "text" fields.
Example: [{"section": "§ 81 Abs. 4 AufenthG", "text": "Requires timely submission..."}]

Output format — use these exact headers:
---EXPLANATION---
(explanation text)
---RESPONSE_DRAFT---
(response letter text)
---CHECKLIST---
(JSON array)
---CITATIONS---
(JSON array)
```

### Streaming Implementation

```python
async def run_rag_pipeline(
    ocr_text: str,
    agent_result: AgentResult,
    language: str
) -> AsyncGenerator[RAGEvent, None]:
    """Generate explanation, response, checklist, citations via RAG + Qwen LLM."""

    # Step 1: Retrieve legal context
    legal_chunks = retrieve_legal_context(ocr_text, agent_result.letter_type)
    formatted_context = format_legal_chunks(legal_chunks)

    # Step 2: Build prompt
    prompt = GENERATION_PROMPT.format(
        ocr_text=ocr_text,
        agent_result=agent_result,
        formatted_legal_context=formatted_context,
        language=language
    )

    # Step 3: Stream Qwen LLM response
    current_section = None
    buffer = ""

    async for token in qwen_stream(prompt):
        buffer += token

        # Detect section headers
        if "---EXPLANATION---" in buffer:
            current_section = "explanation"
            buffer = buffer.split("---EXPLANATION---")[1]
        elif "---RESPONSE_DRAFT---" in buffer:
            # Emit remaining explanation
            current_section = "response_draft"
            buffer = buffer.split("---RESPONSE_DRAFT---")[1]
        elif "---CHECKLIST---" in buffer:
            current_section = "checklist"
            buffer = buffer.split("---CHECKLIST---")[1]
        elif "---CITATIONS---" in buffer:
            current_section = "citations"
            buffer = buffer.split("---CITATIONS---")[1]

        # Stream text sections token by token
        if current_section in ("explanation", "response_draft"):
            yield RAGEvent(type=current_section, data={"chunk": token})

    # Parse and emit structured sections
    checklist = parse_json_section(buffer, "checklist")
    yield RAGEvent(type="checklist", data={"items": checklist})

    citations = parse_json_section(buffer, "citations")
    yield RAGEvent(type="citations", data={"items": citations})
```

---

## Data Contracts

### LegalChunk (internal)

```python
@dataclass
class LegalChunk:
    section: str    # e.g., "§ 81 Abs. 4"
    law: str        # e.g., "AufenthG"
    title: str      # e.g., "Beantragung des Aufenthaltstitels"
    text: str       # full paragraph text
```

### RAGEvent (emitted by this module)

```python
@dataclass
class RAGEvent:
    type: str   # "explanation", "response_draft", "checklist", "citations"
    data: dict
```

### AgentResult (consumed from Dev 4)

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

---

## File Structure

```
ai/
├── rag/
│   ├── ingest.py           # One-time: download, chunk, embed, store legal texts
│   ├── retrieval.py         # Query ChromaDB for relevant § paragraphs
│   ├── generator.py         # Qwen LLM response generation with RAG context
│   ├── prompts.py           # Prompt templates
│   └── schemas.py           # LegalChunk, RAGEvent, etc.
├── data/
│   ├── laws/                # Raw legal text files
│   │   ├── aufenthg.txt
│   │   ├── aufenthv.txt
│   │   └── ...
│   └── chroma/              # ChromaDB persistent storage
```

---

## Dependencies

```
chromadb
httpx          # Qwen API calls
```

---

## Hour-by-Hour Plan

| Hour | Deliverable |
|------|------------|
| 0-1 | ChromaDB setup, download AufenthG full text, write chunking logic (split by §) |
| 1-2 | Embed AufenthG chunks, store in ChromaDB, download + chunk AufenthV, test retrieval |
| 2-3 | Response generation prompt engineering (explanation + draft + checklist) |
| 3-4 | Streaming implementation, § citation extraction, multi-language support |
| 4-5 | Integration with Dev 4 (consume AgentResult), integration with backend |
| 5-6 | Full pipeline testing, prompt tuning, citation accuracy verification |
