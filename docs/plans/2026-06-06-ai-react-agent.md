# AI ReAct Agent Implementation Plan (Dev 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Qwen-VL OCR integration and ReAct agent that classifies German letters, extracts deadlines, assesses consequences, and scores risk.

**Architecture:** Qwen-VL for OCR (image to text). ReAct loop (think-act-observe) with web search tool for classification and consequence assessment. Outputs AgentEvent stream and AgentResult for RAG pipeline.

**Tech Stack:** Python, httpx (Qwen API client), duckduckgo-search (web search tool)

**Spec:** `docs/03-ai-react-agent.md`

---

## File Structure

```
ai/
├── __init__.py
├── react_agent/
│   ├── __init__.py
│   ├── ocr.py              # Qwen-VL OCR: image → text
│   ├── search.py            # Web search tool for the agent
│   ├── agent.py             # ReAct agent loop
│   ├── prompts.py           # System prompts and templates
│   └── schemas.py           # AgentEvent, AgentResult dataclasses
└── requirements.txt         # AI-specific dependencies
```

---

### Task 1: Schemas + Qwen API Client Setup

**Files:**
- Create: `ai/__init__.py`
- Create: `ai/react_agent/__init__.py`
- Create: `ai/react_agent/schemas.py`
- Create: `ai/requirements.txt`

- [ ] **Step 1: Create package structure**

```bash
cd /Users/amirali.iranmanesh/welp/Klar
mkdir -p ai/react_agent
touch ai/__init__.py ai/react_agent/__init__.py
```

- [ ] **Step 2: Create AI requirements**

Create `ai/requirements.txt`:

```
httpx==0.27.0
duckduckgo-search==6.2.0
```

- [ ] **Step 3: Install dependencies**

```bash
source backend/venv/bin/activate
pip install -r ai/requirements.txt
```

- [ ] **Step 4: Create schemas**

Create `ai/react_agent/schemas.py`:

```python
from dataclasses import dataclass, field

@dataclass
class AgentEvent:
    type: str   # "classification", "risk_score", "deadline", "consequence"
    data: dict

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

- [ ] **Step 5: Commit**

```bash
git add ai/
git commit -m "feat(ai): scaffold react_agent package with schemas"
```

---

### Task 2: Qwen-VL OCR Integration

**Files:**
- Create: `ai/react_agent/ocr.py`

- [ ] **Step 1: Implement OCR function**

Create `ai/react_agent/ocr.py`:

```python
import httpx
import base64
import os

QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_API_BASE = os.environ.get("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")

OCR_PROMPT = """Extract all text from this German official letter exactly as written.
Preserve the document structure including:
- Sender name and address (top)
- Reference number (Aktenzeichen/Geschäftszeichen)
- Date
- Subject line (Betreff)
- Full body text
- Footer / signature

Output the text in its original German. Do not translate. Do not summarize."""

async def extract_text_from_image(image_path: str) -> str:
    """Send image to Qwen-VL and return extracted text."""
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    # Detect MIME type
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    mime_type = mime_map.get(ext, "image/jpeg")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{QWEN_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {QWEN_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen-vl-max",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                },
                            },
                            {"type": "text", "text": OCR_PROMPT},
                        ],
                    }
                ],
            },
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
```

- [ ] **Step 2: Write a test script**

Create `ai/react_agent/test_ocr.py`:

```python
"""Quick smoke test for OCR. Run with: python -m ai.react_agent.test_ocr <image_path>"""
import asyncio
import sys
from ai.react_agent.ocr import extract_text_from_image

async def main():
    if len(sys.argv) < 2:
        print("Usage: python -m ai.react_agent.test_ocr <image_path>")
        sys.exit(1)
    text = await extract_text_from_image(sys.argv[1])
    print("=== OCR Result ===")
    print(text)
    print(f"\n=== Length: {len(text)} chars ===")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Test with a sample letter**

```bash
cd /Users/amirali.iranmanesh/welp/Klar
QWEN_API_KEY=<your-key> python -m ai.react_agent.test_ocr path/to/sample-letter.jpg
```

Expected: Extracted German text printed to console.

- [ ] **Step 4: Commit**

```bash
git add ai/react_agent/ocr.py ai/react_agent/test_ocr.py
git commit -m "feat(ai): add Qwen-VL OCR integration"
```

---

### Task 3: Web Search Tool

**Files:**
- Create: `ai/react_agent/search.py`

- [ ] **Step 1: Implement search tool**

Create `ai/react_agent/search.py`:

```python
from duckduckgo_search import DDGS

def web_search(query: str, max_results: int = 5) -> list[dict]:
    """
    Search the web using DuckDuckGo. Returns list of results.
    Falls back gracefully if search fails.
    """
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
            return [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", ""),
                }
                for r in results
            ]
    except Exception:
        # Fallback: ensure demo never crashes
        return [{"title": "Search unavailable", "snippet": "Using model knowledge only", "url": ""}]
```

- [ ] **Step 2: Test search tool**

```python
# Quick test in Python REPL
from ai.react_agent.search import web_search
results = web_search("Ausländerbehörde München Nachreichung Unterlagen Frist")
for r in results:
    print(f"- {r['title']}: {r['snippet'][:100]}")
```

Expected: 3-5 search results about Munich Foreigners Office document requirements.

- [ ] **Step 3: Commit**

```bash
git add ai/react_agent/search.py
git commit -m "feat(ai): add web search tool with DuckDuckGo fallback"
```

---

### Task 4: Agent Prompts

**Files:**
- Create: `ai/react_agent/prompts.py`

- [ ] **Step 1: Create prompt templates**

Create `ai/react_agent/prompts.py`:

```python
from datetime import date

AGENT_SYSTEM_PROMPT = f"""You are Klar, an expert on German bureaucracy — especially immigration, residence permits, and student-related official processes.

You are analyzing an official German letter. Your task:
1. CLASSIFY the letter type (e.g., "Residence Permit - Document Request", "Health Insurance Reminder", "Fine Notice (Bußgeldbescheid)", "Tax Registration", "University Enrollment", etc.)
2. IDENTIFY the sender agency
3. EXTRACT the deadline (exact date if stated, or calculate from "innerhalb von X Tagen/Wochen" relative to the letter date)
4. ASSESS the consequence of missing the deadline — be specific about what happens next
5. ASSIGN a risk score (1-5):
   1 = Informational, no action needed
   2 = Low urgency, action needed but flexible timeline
   3 = Medium, clear deadline with moderate consequences
   4 = High, deadline with serious consequences (financial, legal)
   5 = Critical, missing this threatens legal status in Germany

You have access to a web search tool. Use it to:
- Verify the letter type and sender agency
- Look up current rules, processing times, and requirements for this type of request
- Find what specific consequences follow from missing the deadline
- Check city-specific procedures if the city is identifiable from the letter

Think step by step. Use the search tool when you need current, specific information.
Do NOT guess consequences — verify them via search.

Today's date: {date.today().isoformat()}

After analysis, output your final answer as a JSON object with this exact structure:
```json
{{
  "classification": {{
    "type": "<letter type>",
    "agency": "<sender agency name>"
  }},
  "deadline": {{
    "date": "<YYYY-MM-DD or null>",
    "days_remaining": <integer or null>,
    "source": "<how you determined the deadline>"
  }},
  "consequence": {{
    "text": "<detailed consequence description>",
    "severity": "<one-line severity summary>"
  }},
  "risk_score": {{
    "score": <1-5>,
    "label": "<Informational|Low|Medium|High|Critical>",
    "reason": "<why this score>"
  }}
}}
```"""

TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current information about German bureaucratic processes, legal requirements, deadlines, and consequences.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query. Use German keywords for better results about German bureaucracy.",
                    }
                },
                "required": ["query"],
            },
        },
    }
]
```

- [ ] **Step 2: Commit**

```bash
git add ai/react_agent/prompts.py
git commit -m "feat(ai): add ReAct agent system prompt and tool spec"
```

---

### Task 5: ReAct Agent Loop

**Files:**
- Create: `ai/react_agent/agent.py`

- [ ] **Step 1: Implement agent loop**

Create `ai/react_agent/agent.py`:

```python
import json
import httpx
import os
from typing import AsyncGenerator
from datetime import date, datetime

from ai.react_agent.schemas import AgentEvent, AgentResult
from ai.react_agent.search import web_search
from ai.react_agent.prompts import AGENT_SYSTEM_PROMPT, TOOLS_SPEC

QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_API_BASE = os.environ.get("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")
MAX_ITERATIONS = 5

async def qwen_chat(messages: list[dict], tools: list[dict] | None = None) -> dict:
    """Call Qwen chat completion API."""
    body = {
        "model": "qwen-max",
        "messages": messages,
    }
    if tools:
        body["tools"] = tools

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{QWEN_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {QWEN_API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()
        return response.json()

def parse_agent_result(content: str, ocr_text: str) -> AgentResult:
    """Parse the agent's final JSON output into an AgentResult."""
    # Extract JSON from the response (may be wrapped in markdown code blocks)
    json_str = content
    if "```json" in content:
        json_str = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        json_str = content.split("```")[1].split("```")[0]

    data = json.loads(json_str.strip())

    classification = data.get("classification", {})
    deadline = data.get("deadline", {})
    consequence = data.get("consequence", {})
    risk = data.get("risk_score", {})

    # Calculate days_remaining if we have a deadline date
    days_remaining = deadline.get("days_remaining")
    if deadline.get("date") and days_remaining is None:
        try:
            deadline_date = datetime.strptime(deadline["date"], "%Y-%m-%d").date()
            days_remaining = (deadline_date - date.today()).days
        except ValueError:
            pass

    return AgentResult(
        ocr_text=ocr_text,
        letter_type=classification.get("type", "Unknown"),
        agency=classification.get("agency", "Unknown"),
        deadline_date=deadline.get("date"),
        days_remaining=days_remaining,
        consequence=consequence.get("text", "Unknown consequence"),
        risk_score=risk.get("score", 3),
        risk_label=risk.get("label", "Medium"),
    )

async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]:
    """
    Run the ReAct agent loop. Yields AgentEvents as the agent processes.
    The agent can call web_search tool to gather information.
    """
    messages = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze this German official letter:\n\n{ocr_text}"},
    ]

    for iteration in range(MAX_ITERATIONS):
        result = await qwen_chat(messages, tools=TOOLS_SPEC)
        choice = result["choices"][0]
        message = choice["message"]

        # Check if the model wants to call a tool
        tool_calls = message.get("tool_calls")

        if tool_calls:
            # Agent wants to search — execute the tool
            messages.append(message)

            for tool_call in tool_calls:
                func_name = tool_call["function"]["name"]
                func_args = json.loads(tool_call["function"]["arguments"])

                if func_name == "web_search":
                    search_results = web_search(func_args["query"])
                    tool_response = json.dumps(search_results, ensure_ascii=False)
                else:
                    tool_response = json.dumps({"error": f"Unknown tool: {func_name}"})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": tool_response,
                })
        else:
            # Agent is done — parse the final answer
            content = message.get("content", "")
            try:
                agent_result = parse_agent_result(content, ocr_text)

                yield AgentEvent("classification", {
                    "type": agent_result.letter_type,
                    "agency": agent_result.agency,
                })
                yield AgentEvent("risk_score", {
                    "score": agent_result.risk_score,
                    "label": agent_result.risk_label,
                })
                if agent_result.deadline_date:
                    yield AgentEvent("deadline", {
                        "date": agent_result.deadline_date,
                        "days_remaining": agent_result.days_remaining,
                    })
                yield AgentEvent("consequence", {
                    "text": agent_result.consequence,
                })
                return

            except (json.JSONDecodeError, KeyError) as e:
                yield AgentEvent("error", {"message": f"Failed to parse agent output: {e}"})
                return

    # Max iterations reached
    yield AgentEvent("error", {"message": "Agent exceeded maximum iterations"})

def get_last_agent_result(events: list[AgentEvent], ocr_text: str) -> AgentResult:
    """Reconstruct an AgentResult from collected events (helper for orchestrator)."""
    data = {}
    for event in events:
        data[event.type] = event.data

    classification = data.get("classification", {})
    deadline = data.get("deadline", {})
    risk = data.get("risk_score", {})
    consequence = data.get("consequence", {})

    return AgentResult(
        ocr_text=ocr_text,
        letter_type=classification.get("type", "Unknown"),
        agency=classification.get("agency", "Unknown"),
        deadline_date=deadline.get("date"),
        days_remaining=deadline.get("days_remaining"),
        consequence=consequence.get("text", ""),
        risk_score=risk.get("score", 3),
        risk_label=risk.get("label", "Medium"),
    )
```

- [ ] **Step 2: Write an integration test script**

Create `ai/react_agent/test_agent.py`:

```python
"""Smoke test for the full ReAct agent. Run: python -m ai.react_agent.test_agent"""
import asyncio
from ai.react_agent.agent import run_react_agent

SAMPLE_LETTER = """
Landeshauptstadt München
Kreisverwaltungsreferat
Ausländerangelegenheiten

Datum: 01.06.2026
Aktenzeichen: AZ 456/789

Betreff: Nachreichung von Unterlagen zu Ihrem Antrag auf Aufenthaltserlaubnis

Sehr geehrte/r Antragsteller/in,

zur Bearbeitung Ihres Antrags auf Erteilung einer Aufenthaltserlaubnis nach § 16b AufenthG
bitten wir Sie, folgende Unterlagen innerhalb von 14 Tagen einzureichen:

1. Nachweis über eine Krankenversicherung
2. Finanzierungsnachweis (Sperrkonto oder Verpflichtungserklärung)
3. Aktuelle Immatrikulationsbescheinigung

Sollten die Unterlagen nicht fristgerecht eingehen, wird Ihr Antrag
als zurückgenommen betrachtet (§ 81 Abs. 4 AufenthG).

Mit freundlichen Grüßen
Sachbearbeiter/in
"""

async def main():
    print("Running ReAct agent on sample letter...\n")
    async for event in run_react_agent(SAMPLE_LETTER):
        print(f"[{event.type}] {event.data}")
    print("\nDone.")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Test the agent**

```bash
cd /Users/amirali.iranmanesh/welp/Klar
QWEN_API_KEY=<your-key> python -m ai.react_agent.test_agent
```

Expected: Agent classifies the letter, extracts deadline, assesses consequences, scores risk 5/5 (Critical).

- [ ] **Step 4: Commit**

```bash
git add ai/react_agent/agent.py ai/react_agent/test_agent.py
git commit -m "feat(ai): implement ReAct agent loop with search tool and structured output"
```

---

### Task 6: Wire into Backend Orchestrator

**Files:**
- Modify: `backend/pipeline/orchestrator.py` (replace mock_ocr and mock_react_agent)

- [ ] **Step 1: Update orchestrator to use real AI functions**

In `backend/pipeline/orchestrator.py`, replace the mock imports and functions. Add at the top:

```python
import sys
import os
# Add project root to path so we can import ai modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ai.react_agent.ocr import extract_text_from_image
from ai.react_agent.agent import run_react_agent, get_last_agent_result
from ai.react_agent.schemas import AgentEvent, AgentResult
```

In `run_pipeline()`, replace `mock_ocr` with `extract_text_from_image` and `mock_react_agent` with `run_react_agent`:

```python
async def run_pipeline(file_path: str, language: str) -> AsyncGenerator[str, None]:
    try:
        # Step 1: OCR (real)
        ocr_text = await extract_text_from_image(file_path)
        yield sse_event("ocr_result", {"text": ocr_text})

        # Step 2: ReAct Agent (real)
        agent_events = []
        async for event in run_react_agent(ocr_text):
            yield sse_event(event.type, event.data)
            agent_events.append(event)

        agent_result = get_last_agent_result(agent_events, ocr_text)

        # Step 3 + 4: RAG (still mock until Dev 3 delivers)
        async for event in mock_rag_pipeline(ocr_text, agent_result, language):
            yield sse_event(event.type, event.data)

        yield sse_event("done", {"status": "complete"})
    except Exception as e:
        yield sse_event("error", {"message": str(e)})
```

- [ ] **Step 2: Test end-to-end with backend**

```bash
cd backend && source venv/bin/activate
QWEN_API_KEY=<key> uvicorn main:app --reload --port 8000
```

Upload an image via the frontend or curl, then hit the process endpoint. Real OCR and agent should run.

- [ ] **Step 3: Commit**

```bash
git add backend/pipeline/orchestrator.py
git commit -m "feat(ai): wire real OCR and ReAct agent into backend pipeline"
```
