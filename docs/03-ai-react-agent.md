# Klar — AI ReAct Agent Spec

**Owner: Dev 4 (AI: ReAct)**
**Stack: Qwen-VL (OCR) + Qwen text model (agent) + Web Search API**
**Integration: Provides async generator functions called by Backend (Dev 2)**

---

## Responsibilities

Dev 4 owns two things:

1. **OCR** — Extract text from uploaded letter images using Qwen-VL
2. **ReAct Agent** — Classify the letter, extract deadlines, assess consequences, score risk

---

## 1. OCR with Qwen-VL

### Input
- Image file path (JPG/PNG) — already converted from PDF by the backend

### Process
- Send image to Qwen-VL API with a carefully crafted prompt
- The prompt must instruct the model to extract ALL text, preserving structure (sender, date, reference numbers, body, footer)

### Prompt Template

```
Extract all text from this German official letter exactly as written.
Preserve the document structure including:
- Sender name and address (top)
- Reference number (Aktenzeichen/Geschäftszeichen)
- Date
- Subject line (Betreff)
- Full body text
- Footer / signature

Output the text in its original German. Do not translate. Do not summarize.
```

### Output
- Raw extracted text as a string

### Function Signature

```python
async def extract_text_from_image(image_path: str) -> str:
    """Send image to Qwen-VL, return extracted text."""
```

---

## 2. ReAct Agent

### What is a ReAct Agent?

A loop where the LLM reasons ("think") and then takes actions ("act") using tools, observes the results, and repeats until it has enough information to produce a final answer.

```
while not done:
    thought = llm.think(context)        # "I need to find out..."
    action = llm.choose_action(thought) # search("query")
    observation = execute(action)       # search results
    context.append(thought, action, observation)
final_answer = llm.conclude(context)
```

### Tools Available to the Agent

The agent has ONE tool:

```python
def web_search(query: str) -> list[dict]:
    """
    Search the web and return results.
    Returns: [{"title": "...", "snippet": "...", "url": "..."}, ...]
    """
```

**Implementation:** Use Tavily API (free tier: 1000 searches/month) or DuckDuckGo (`duckduckgo-search` Python package — no API key needed).

**Fallback:** If the search tool fails (rate limit, timeout, provider down), the agent should continue with its own knowledge and note lower confidence. Wrap search calls in a try/except that returns `[{"snippet": "Search unavailable — using model knowledge only"}]` on failure. This ensures the demo never crashes mid-presentation.

### Agent System Prompt

```
You are Klar, an expert on German bureaucracy — especially immigration,
residence permits, and student-related official processes.

You are analyzing an official German letter. Your task:
1. CLASSIFY the letter type (e.g., "Residence Permit - Document Request",
   "Health Insurance Reminder", "Fine Notice", "Tax Registration", etc.)
2. IDENTIFY the sender agency
3. EXTRACT the deadline (exact date if stated, or calculate from "within X days/weeks")
4. ASSESS the consequence of missing the deadline
5. ASSIGN a risk score (1-5):
   1 = Informational, no action needed
   2 = Low urgency, action needed but flexible timeline
   3 = Medium, clear deadline with moderate consequences
   4 = High, deadline with serious consequences (financial, legal)
   5 = Critical, missing this threatens legal status in Germany

You have access to a web search tool. Use it to:
- Verify the letter type and sender
- Look up current rules and processing times for this type of request
- Find what happens if the deadline is missed
- Check city-specific procedures if the city is identifiable

Think step by step. Use the search tool when you need current, specific information.
Do NOT guess consequences — verify them.

Today's date: {current_date}
```

### Agent Input

The OCR-extracted text from Step 1.

### Agent Output Format

The agent must produce a structured JSON result:

```json
{
  "classification": {
    "type": "Residence Permit - Document Request",
    "agency": "Ausländerbehörde München",
    "reference_number": "AZ 123/456"
  },
  "deadline": {
    "date": "2026-06-20",
    "days_remaining": 14,
    "source": "Letter states 'innerhalb von 14 Tagen'"
  },
  "consequence": {
    "text": "If you miss this deadline, your residence permit application will be considered withdrawn (§ 81 Abs. 4 AufenthG). You would need to re-apply and book a new appointment, which currently has a 6-8 week wait time in Munich.",
    "severity": "Application withdrawal, potential gap in legal residence status"
  },
  "risk_score": {
    "score": 5,
    "label": "Critical",
    "reason": "Missing this directly threatens your legal right to stay in Germany"
  }
}
```

### ReAct Loop Implementation

```python
import json

MAX_ITERATIONS = 5  # Safety limit

async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]:
    messages = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze this letter:\n\n{ocr_text}"}
    ]

    for i in range(MAX_ITERATIONS):
        response = await qwen_chat(messages, tools=TOOLS)

        if response.has_tool_call:
            # Agent wants to search
            tool_call = response.tool_call
            search_results = await web_search(tool_call.arguments["query"])
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "tool",
                "content": json.dumps(search_results)
            })
        else:
            # Agent is done — parse final answer
            result = parse_agent_result(response.content)

            yield AgentEvent(type="classification", data=result.classification)
            yield AgentEvent(type="risk_score", data=result.risk_score)
            yield AgentEvent(type="deadline", data=result.deadline)
            yield AgentEvent(type="consequence", data=result.consequence)
            return

    # Safety: max iterations reached
    yield AgentEvent(type="error", data={"message": "Agent exceeded max iterations"})
```

### Streaming Behavior

The ReAct agent emits events in order:
1. `classification` — as soon as the letter type is determined
2. `risk_score` — risk level
3. `deadline` — extracted deadline info
4. `consequence` — what happens if missed

Note: In the basic implementation above, all four events fire at the end after the agent concludes. For a more responsive UX, Dev 4 can optionally emit intermediate events during the loop if the agent identifies partial results early. This is a stretch goal.

---

## Data Contracts

### AgentEvent (emitted by this module)

```python
@dataclass
class AgentEvent:
    type: str   # "classification", "risk_score", "deadline", "consequence", "error"
    data: dict
```

### AgentResult (consumed by Dev 3 - RAG)

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

## Dependencies

```
httpx                  # HTTP client for Qwen API calls
duckduckgo-search      # Free web search (no API key needed), OR:
# tavily-python        # Tavily search (needs free API key)
```

---

## Testing Strategy

Test with at least these letter types:
1. **Ausländerbehörde document request** — residence permit, nachreichung
2. **Health insurance letter** (Krankenkasse) — proof of coverage
3. **Finanzamt** — tax ID registration
4. **University enrollment** — Immatrikulationsbescheinigung request
5. **Bußgeldbescheid** — traffic fine

For the hackathon, prepare 2-3 anonymized sample letters as test fixtures. These can be fabricated but should look realistic.

---

## Hour-by-Hour Plan

| Hour | Deliverable |
|------|------------|
| 0-1 | Qwen-VL OCR integration — send image, get text back. Test with a sample letter |
| 1-2 | ReAct agent loop — implement think/act/observe cycle with web search tool |
| 2-3 | Agent prompt engineering — classification, deadline extraction |
| 3-4 | Consequence assessment, risk scoring prompts. Test diverse letter types |
| 4-5 | Integration with backend (expose async generator), integration with RAG (pass AgentResult) |
| 5-6 | Edge case testing, prompt tuning, demo preparation |
