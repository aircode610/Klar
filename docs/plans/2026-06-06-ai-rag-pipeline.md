# AI RAG Pipeline Implementation Plan (Dev 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the RAG pipeline — ingest German legal texts into ChromaDB, retrieve relevant paragraphs at runtime, and generate explanations, response drafts, checklists, and legal citations via Qwen LLM.

**Architecture:** ChromaDB stores embedded legal text chunks. At runtime: query ChromaDB for relevant paragraphs, inject into Qwen LLM prompt, stream response generation with structured output (explanation, response draft, checklist, citations).

**Tech Stack:** Python, ChromaDB, httpx (Qwen API), BeautifulSoup (law text scraping)

**Spec:** `docs/04-ai-rag-pipeline.md`

---

## File Structure

```
ai/
├── rag/
│   ├── __init__.py
│   ├── ingest.py            # Download, chunk, embed, store legal texts
│   ├── retrieval.py          # Query ChromaDB for relevant § paragraphs
│   ├── generator.py          # Qwen LLM response generation with streaming
│   ├── prompts.py            # Prompt templates for response generation
│   └── schemas.py            # RAGEvent, LegalChunk dataclasses
├── data/
│   ├── laws/                 # Downloaded legal text files
│   └── chroma/               # ChromaDB persistent storage
└── requirements.txt          # (already created, add chromadb)
```

---

### Task 1: Schemas + Package Setup

**Files:**
- Create: `ai/rag/__init__.py`
- Create: `ai/rag/schemas.py`
- Modify: `ai/requirements.txt`

- [ ] **Step 1: Create package structure**

```bash
cd /Users/amirali.iranmanesh/welp/Klar
mkdir -p ai/rag ai/data/laws ai/data/chroma
touch ai/rag/__init__.py
```

- [ ] **Step 2: Add chromadb to requirements**

Append to `ai/requirements.txt`:

```
chromadb==0.5.0
beautifulsoup4==4.12.3
requests==2.32.0
```

- [ ] **Step 3: Install**

```bash
source backend/venv/bin/activate
pip install -r ai/requirements.txt
```

- [ ] **Step 4: Create schemas**

Create `ai/rag/schemas.py`:

```python
from dataclasses import dataclass

@dataclass
class LegalChunk:
    section: str      # e.g., "§ 81 Abs. 4"
    law: str          # e.g., "AufenthG"
    title: str        # e.g., "Beantragung des Aufenthaltstitels"
    text: str         # full paragraph text

@dataclass
class RAGEvent:
    type: str   # "explanation", "response_draft", "checklist", "citations"
    data: dict
```

- [ ] **Step 5: Commit**

```bash
git add ai/rag/ ai/data/ ai/requirements.txt
git commit -m "feat(ai): scaffold RAG pipeline package with schemas"
```

---

### Task 2: Legal Text Ingestion

**Files:**
- Create: `ai/rag/ingest.py`

- [ ] **Step 1: Implement legal text downloader and chunker**

Create `ai/rag/ingest.py`:

```python
"""
Download German legal texts from gesetze-im-internet.de, chunk by §, embed, store in ChromaDB.

Usage:
    python -m ai.rag.ingest
"""

import os
import re
import requests
from bs4 import BeautifulSoup
import chromadb
import httpx
import asyncio

QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_API_BASE = os.environ.get("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chroma")

# Laws to ingest (URL slug on gesetze-im-internet.de)
LAWS = {
    "AufenthG": "aufenthg_2004",
    "AufenthV": "aufenthv",
}

def download_law_text(slug: str) -> str:
    """Download the full text of a law from gesetze-im-internet.de."""
    url = f"https://www.gesetze-im-internet.de/{slug}/BJNR195010004.html"
    # Try the main page first, fall back to index
    try:
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            # Try alternative URL format
            url = f"https://www.gesetze-im-internet.de/{slug}/"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
    except requests.RequestException:
        # Try the index page which lists all sections
        url = f"https://www.gesetze-im-internet.de/{slug}/index.html"
        response = requests.get(url, timeout=30)
        response.raise_for_status()

    return response.text

def parse_law_sections(html: str, law_abbrev: str) -> list[dict]:
    """Parse law HTML into individual § sections."""
    soup = BeautifulSoup(html, "html.parser")
    sections = []

    # gesetze-im-internet.de uses specific HTML structures
    # Try to find individual law sections
    for element in soup.find_all(["div", "p", "h2", "h3"]):
        text = element.get_text(strip=True)
        # Look for § patterns
        match = re.match(r"(§\s*\d+[a-z]?(?:\s*Abs\.\s*\d+)?)\s*(.*)", text)
        if match:
            section_num = match.group(1)
            # Get the following text content
            content_parts = []
            for sibling in element.find_next_siblings():
                sibling_text = sibling.get_text(strip=True)
                if sibling_text and re.match(r"§\s*\d+", sibling_text):
                    break  # Next section starts
                if sibling_text:
                    content_parts.append(sibling_text)
                if len(content_parts) > 20:
                    break

            full_text = f"{text}\n" + "\n".join(content_parts[:10])
            sections.append({
                "section": section_num,
                "law": law_abbrev,
                "title": match.group(2)[:200],
                "text": full_text[:2000],
            })

    return sections

def chunk_law_from_text(raw_text: str, law_abbrev: str) -> list[dict]:
    """
    Fallback chunking: split raw law text by § markers.
    Works with plain text or stripped HTML.
    """
    # Split by § markers
    parts = re.split(r"(§\s*\d+[a-z]?)", raw_text)
    sections = []

    i = 1  # Skip text before first §
    while i < len(parts) - 1:
        section_num = parts[i].strip()
        body = parts[i + 1].strip()

        # Extract title (first line after §)
        lines = body.split("\n")
        title = lines[0].strip() if lines else ""
        full_text = f"{section_num} {body[:2000]}"

        sections.append({
            "section": section_num,
            "law": law_abbrev,
            "title": title[:200],
            "text": full_text,
        })
        i += 2

    return sections

async def embed_text(text: str) -> list[float]:
    """Get embedding vector from Qwen embedding API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{QWEN_API_BASE}/embeddings",
            headers={
                "Authorization": f"Bearer {QWEN_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "text-embedding-v3",
                "input": text[:8000],  # Truncate to model max
            },
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]

async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts. Processes in batches to avoid rate limits."""
    embeddings = []
    batch_size = 10
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_embeddings = await asyncio.gather(
            *[embed_text(t) for t in batch]
        )
        embeddings.extend(batch_embeddings)
        if i + batch_size < len(texts):
            await asyncio.sleep(0.5)  # Rate limit courtesy
    return embeddings

async def ingest_law(law_abbrev: str, slug: str, collection):
    """Download, chunk, embed, and store one law."""
    print(f"Downloading {law_abbrev} ({slug})...")
    html = download_law_text(slug)

    # Try structured parsing first, fall back to text chunking
    soup = BeautifulSoup(html, "html.parser")
    raw_text = soup.get_text()

    sections = parse_law_sections(html, law_abbrev)
    if len(sections) < 5:
        print(f"  Structured parsing found only {len(sections)} sections, trying text chunking...")
        sections = chunk_law_from_text(raw_text, law_abbrev)

    print(f"  Found {len(sections)} sections")

    if not sections:
        print(f"  WARNING: No sections found for {law_abbrev}. Skipping.")
        return

    # Embed all sections
    texts = [s["text"] for s in sections]
    print(f"  Embedding {len(texts)} chunks...")
    embeddings = await embed_batch(texts)

    # Store in ChromaDB
    collection.add(
        ids=[f"{law_abbrev}_{i}" for i in range(len(sections))],
        documents=texts,
        metadatas=[{
            "law": s["law"],
            "section": s["section"],
            "title": s["title"],
        } for s in sections],
        embeddings=embeddings,
    )
    print(f"  Stored {len(sections)} chunks in ChromaDB")

async def main():
    """Run the full ingestion pipeline."""
    os.makedirs(CHROMA_PATH, exist_ok=True)

    client = chromadb.PersistentClient(path=CHROMA_PATH)
    # Delete and recreate to start fresh
    try:
        client.delete_collection("german_laws")
    except ValueError:
        pass
    collection = client.create_collection(
        name="german_laws",
        metadata={"hnsw:space": "cosine"},
    )

    for law_abbrev, slug in LAWS.items():
        await ingest_law(law_abbrev, slug, collection)

    print(f"\nDone. Total documents in collection: {collection.count()}")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run ingestion**

```bash
cd /Users/amirali.iranmanesh/welp/Klar
QWEN_API_KEY=<key> python -m ai.rag.ingest
```

Expected: Downloads AufenthG and AufenthV, chunks by §, embeds via Qwen, stores in ChromaDB. Prints section counts.

- [ ] **Step 3: Commit**

```bash
git add ai/rag/ingest.py
git commit -m "feat(ai): add legal text ingestion pipeline for ChromaDB"
```

---

### Task 3: RAG Retrieval

**Files:**
- Create: `ai/rag/retrieval.py`

- [ ] **Step 1: Implement retrieval function**

Create `ai/rag/retrieval.py`:

```python
import os
import chromadb
from ai.rag.schemas import LegalChunk

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chroma")

_client = None
_collection = None

def get_collection():
    """Lazy-load ChromaDB collection."""
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _client.get_collection("german_laws")
    return _collection

def retrieve_legal_context(
    ocr_text: str,
    letter_type: str,
    top_k: int = 5,
) -> list[LegalChunk]:
    """
    Retrieve the most relevant § paragraphs from ChromaDB.
    Uses the letter text + classification as the query.
    """
    collection = get_collection()

    # Combine letter type and first 500 chars of OCR for better relevance
    query = f"{letter_type}: {ocr_text[:500]}"

    results = collection.query(
        query_texts=[query],
        n_results=top_k,
    )

    chunks = []
    if results["documents"] and results["metadatas"]:
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            chunks.append(LegalChunk(
                section=meta.get("section", "Unknown"),
                law=meta.get("law", "Unknown"),
                title=meta.get("title", ""),
                text=doc,
            ))

    return chunks

def format_legal_chunks(chunks: list[LegalChunk]) -> str:
    """Format retrieved chunks for inclusion in the LLM prompt."""
    if not chunks:
        return "No specific legal references found in the knowledge base."

    parts = []
    for chunk in chunks:
        parts.append(f"### {chunk.section} {chunk.law} — {chunk.title}\n{chunk.text}")
    return "\n\n".join(parts)
```

- [ ] **Step 2: Test retrieval**

```python
# Quick test in Python REPL
from ai.rag.retrieval import retrieve_legal_context, format_legal_chunks

chunks = retrieve_legal_context(
    "Nachreichung von Unterlagen Aufenthaltserlaubnis",
    "Residence Permit - Document Request"
)
print(f"Found {len(chunks)} relevant chunks:")
for c in chunks:
    print(f"  - {c.section} {c.law}: {c.title[:60]}")
print("\nFormatted:")
print(format_legal_chunks(chunks)[:500])
```

Expected: Returns 5 relevant § paragraphs, likely including § 81 AufenthG.

- [ ] **Step 3: Commit**

```bash
git add ai/rag/retrieval.py
git commit -m "feat(ai): add ChromaDB retrieval for legal § paragraphs"
```

---

### Task 4: Response Generation Prompts

**Files:**
- Create: `ai/rag/prompts.py`

- [ ] **Step 1: Create generation prompt template**

Create `ai/rag/prompts.py`:

```python
GENERATION_PROMPT = """You are Klar, an expert assistant helping international students in Germany understand and respond to official letters.

## The Letter (Original Text)
{ocr_text}

## Classification
Type: {letter_type}
Agency: {agency}
Deadline: {deadline_date} ({days_remaining} days remaining)
Risk: {risk_score}/5 — {risk_label}
Consequence: {consequence}

## Relevant Legal References
{legal_context}

## Your Tasks

Generate the following four sections. Be precise, professional, and helpful.

### 1. EXPLANATION
Write a clear, plain-language explanation of this letter in {language}.
- What is this letter about?
- Who sent it and why?
- What action is required from the recipient?
- What is the deadline and how urgent is it?
- What specific consequences follow if the deadline is missed?
- Reference the relevant § paragraphs where they support your explanation.

### 2. RESPONSE DRAFT
Write a formal response letter in Behördendeutsch (official German bureaucratic language) that the user can send back to the agency. Include:
- Proper formal salutation ("Sehr geehrte Damen und Herren,")
- Reference number (Aktenzeichen) from the original letter if available
- Clear statement of what is being submitted or responded to
- List of enclosed documents (Anlagen)
- Professional closing ("Mit freundlichen Grüßen")
- Placeholder [Name] for the sender's name

### 3. DOCUMENT CHECKLIST
List ALL documents the user needs to prepare or submit, based on the letter's requirements.
Format as a JSON array of strings. Each item should be clear and include the German term in parentheses.
Example: ["Proof of health insurance (Krankenversicherungsnachweis)"]

### 4. CITATIONS
List all § legal references that are relevant to this letter, with brief explanations of why each is relevant.
Format as a JSON array of objects with "section" and "text" fields.
Example: [{{"section": "§ 81 Abs. 4 AufenthG", "text": "Requires timely submission of documents..."}}]

IMPORTANT: Use these exact section delimiters in your output:
---EXPLANATION---
(your explanation here)
---RESPONSE_DRAFT---
(your response letter here)
---CHECKLIST---
(JSON array here)
---CITATIONS---
(JSON array here)"""

LANGUAGE_NAMES = {
    "en": "English",
    "de": "German",
    "tr": "Turkish",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "zh": "Chinese",
}
```

- [ ] **Step 2: Commit**

```bash
git add ai/rag/prompts.py
git commit -m "feat(ai): add response generation prompt template with multi-language support"
```

---

### Task 5: Streaming Response Generator

**Files:**
- Create: `ai/rag/generator.py`

- [ ] **Step 1: Implement streaming generator**

Create `ai/rag/generator.py`:

```python
import json
import os
import httpx
from typing import AsyncGenerator

from ai.react_agent.schemas import AgentResult
from ai.rag.schemas import RAGEvent
from ai.rag.retrieval import retrieve_legal_context, format_legal_chunks
from ai.rag.prompts import GENERATION_PROMPT, LANGUAGE_NAMES

QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_API_BASE = os.environ.get("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")

async def qwen_stream(prompt: str, system: str = "") -> AsyncGenerator[str, None]:
    """Stream tokens from Qwen chat completion API."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{QWEN_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {QWEN_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen-max",
                "messages": messages,
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        return
                    try:
                        data = json.loads(data_str)
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

async def run_rag_pipeline(
    ocr_text: str,
    agent_result: AgentResult,
    language: str,
) -> AsyncGenerator[RAGEvent, None]:
    """
    Generate explanation, response draft, checklist, and citations.
    Streams explanation and response_draft token by token.
    Emits checklist and citations as single events.
    """
    # Step 1: Retrieve legal context from ChromaDB
    legal_chunks = retrieve_legal_context(ocr_text, agent_result.letter_type)
    legal_context = format_legal_chunks(legal_chunks)

    # Step 2: Build the prompt
    lang_name = LANGUAGE_NAMES.get(language, "English")
    prompt = GENERATION_PROMPT.format(
        ocr_text=ocr_text[:3000],  # Truncate very long OCR text
        letter_type=agent_result.letter_type,
        agency=agent_result.agency,
        deadline_date=agent_result.deadline_date or "Not specified",
        days_remaining=agent_result.days_remaining or "Unknown",
        risk_score=agent_result.risk_score,
        risk_label=agent_result.risk_label,
        consequence=agent_result.consequence,
        legal_context=legal_context,
        language=lang_name,
    )

    # Step 3: Stream the response
    full_response = ""
    current_section = None
    section_buffer = ""

    async for token in qwen_stream(prompt):
        full_response += token

        # Check for section delimiters in the accumulated response
        if "---EXPLANATION---" in full_response and current_section is None:
            current_section = "explanation"
            # Get text after the delimiter
            after = full_response.split("---EXPLANATION---", 1)[1]
            if after:
                yield RAGEvent("explanation", {"chunk": after})
                section_buffer = after
            continue

        if "---RESPONSE_DRAFT---" in full_response and current_section == "explanation":
            current_section = "response_draft"
            section_buffer = ""
            continue

        if "---CHECKLIST---" in full_response and current_section == "response_draft":
            current_section = "checklist"
            section_buffer = ""
            continue

        if "---CITATIONS---" in full_response and current_section == "checklist":
            current_section = "citations"
            section_buffer = ""
            continue

        # Stream text sections token by token
        if current_section == "explanation":
            # Don't stream if we're about to hit the next delimiter
            if "---RESPONSE" not in token:
                yield RAGEvent("explanation", {"chunk": token})
                section_buffer += token

        elif current_section == "response_draft":
            if "---CHECK" not in token:
                yield RAGEvent("response_draft", {"chunk": token})
                section_buffer += token

        elif current_section in ("checklist", "citations"):
            section_buffer += token

    # Parse structured sections from the full response
    try:
        checklist_text = full_response.split("---CHECKLIST---")[1].split("---CITATIONS---")[0].strip()
        checklist = json.loads(checklist_text)
        yield RAGEvent("checklist", {"items": checklist})
    except (IndexError, json.JSONDecodeError):
        yield RAGEvent("checklist", {"items": ["Unable to parse checklist — review the letter manually"]})

    try:
        citations_text = full_response.split("---CITATIONS---")[1].strip()
        # Remove any trailing delimiters
        citations_text = citations_text.split("---")[0].strip()
        citations = json.loads(citations_text)
        yield RAGEvent("citations", {"items": citations})
    except (IndexError, json.JSONDecodeError):
        # Fallback: create citations from the RAG chunks we retrieved
        fallback_citations = [
            {"section": f"{c.section} {c.law}", "text": c.title}
            for c in legal_chunks
        ]
        yield RAGEvent("citations", {"items": fallback_citations})
```

- [ ] **Step 2: Write an integration test**

Create `ai/rag/test_rag.py`:

```python
"""Smoke test for the RAG pipeline. Run: python -m ai.rag.test_rag"""
import asyncio
from ai.react_agent.schemas import AgentResult
from ai.rag.generator import run_rag_pipeline

SAMPLE_OCR = """
Landeshauptstadt München
Kreisverwaltungsreferat — Ausländerangelegenheiten
Aktenzeichen: AZ 456/789

Betreff: Nachreichung von Unterlagen

Sehr geehrte/r Antragsteller/in,

zur Bearbeitung Ihres Antrags auf Erteilung einer Aufenthaltserlaubnis
bitten wir Sie, folgende Unterlagen innerhalb von 14 Tagen einzureichen:
- Nachweis über Krankenversicherung
- Finanzierungsnachweis
- Aktuelle Immatrikulationsbescheinigung

Sollten die Unterlagen nicht fristgerecht eingehen, wird Ihr Antrag
als zurückgenommen betrachtet (§ 81 Abs. 4 AufenthG).
"""

SAMPLE_AGENT_RESULT = AgentResult(
    ocr_text=SAMPLE_OCR,
    letter_type="Residence Permit - Document Request",
    agency="Ausländerbehörde München",
    deadline_date="2026-06-20",
    days_remaining=14,
    consequence="Application considered withdrawn if documents not submitted in time.",
    risk_score=5,
    risk_label="Critical",
)

async def main():
    print("Running RAG pipeline...\n")
    async for event in run_rag_pipeline(SAMPLE_OCR, SAMPLE_AGENT_RESULT, "en"):
        if event.type in ("explanation", "response_draft"):
            print(event.data["chunk"], end="", flush=True)
        else:
            print(f"\n\n[{event.type}] {json.dumps(event.data, indent=2)}")
    print("\n\nDone.")

import json

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Test**

```bash
cd /Users/amirali.iranmanesh/welp/Klar
QWEN_API_KEY=<key> python -m ai.rag.test_rag
```

Expected: Streams explanation in English, response draft in German, then checklist and citations as JSON.

- [ ] **Step 4: Commit**

```bash
git add ai/rag/generator.py ai/rag/test_rag.py
git commit -m "feat(ai): add streaming RAG response generator with Qwen LLM"
```

---

### Task 6: Wire into Backend Orchestrator

**Files:**
- Modify: `backend/pipeline/orchestrator.py` (replace mock_rag_pipeline)

- [ ] **Step 1: Update orchestrator to use real RAG**

In `backend/pipeline/orchestrator.py`, add the RAG import:

```python
from ai.rag.generator import run_rag_pipeline
```

In `run_pipeline()`, replace `mock_rag_pipeline` with `run_rag_pipeline`:

```python
        # Step 3 + 4: RAG + Response Generation (real)
        async for event in run_rag_pipeline(ocr_text, agent_result, language):
            yield sse_event(event.type, event.data)
```

Remove the `mock_rag_pipeline` function entirely.

- [ ] **Step 2: Test full pipeline end-to-end**

```bash
cd backend && source venv/bin/activate
QWEN_API_KEY=<key> uvicorn main:app --reload --port 8000
```

Upload a real letter image. The SSE stream should now use:
- Real OCR (Dev 4)
- Real ReAct agent (Dev 4)
- Real RAG + response generation (Dev 3)

- [ ] **Step 3: Commit**

```bash
git add backend/pipeline/orchestrator.py
git commit -m "feat(ai): wire real RAG pipeline into backend, remove all mocks"
```
