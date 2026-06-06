# Klar — AI ReAct Agent Spec

**Owner: Dev 4 (AI: ReAct)**
**Stack: Qwen-VL (OCR) + Qwen reasoning model (agent) + LangGraph + Tavily Search**
**Integration: Provides async generator functions called by Backend (Dev 2)**

---

## Responsibilities

Dev 4 owns two things:

1. **OCR** — Extract text from uploaded letter images using Qwen-VL
2. **ReAct Agent** — Classify the letter, extract deadlines, assess consequences, score risk

---

## Tech Stack Details

### Models (Qwen Cloud — OpenAI-compatible API)

| Task | Model | Why |
|------|-------|-----|
| OCR | `qwen-vl-plus` | Fast vision model, good enough for document text extraction. Use `qwen-vl-max` if quality is insufficient |
| ReAct Agent | `qwen-plus` | Fast reasoning with tool calling support. Speed is the priority. Fall back to `qwen-max` only if tool calling fails |

**API Base:** `https://dashscope.aliyuncs.com/compatible-mode/v1` (OpenAI-compatible)

The Qwen API is fully OpenAI-compatible, so we use `langchain_openai.ChatOpenAI` with a custom `base_url` and `api_key`.

### Framework

- **LangGraph** — StateGraph-based ReAct agent with tool nodes and conditional edges
- **Tavily** — Web search via `langchain_community.tools.tavily_search.TavilySearchResults` (built-in LangChain integration)

---

## 1. OCR with Qwen-VL

### Input
- Image file path (JPG/PNG) — already converted from PDF by the backend

### Process
- Send image to Qwen-VL API via OpenAI-compatible endpoint
- Use `qwen-vl-plus` for speed (falls back to `qwen-vl-max` if quality is poor)

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

## 2. ReAct Agent (LangGraph)

### Architecture

The agent uses LangGraph's StateGraph pattern:

```
START → llm_call → should_continue?
                      ├── has tool calls → tool_node → llm_call (loop)
                      └── no tool calls  → parse_output → END
```

### LangGraph Setup

```python
from langchain_openai import ChatOpenAI
from langchain_community.tools.tavily_search import TavilySearchResults

# Qwen as OpenAI-compatible model
model = ChatOpenAI(
    model="qwen-plus",
    api_key=QWEN_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    temperature=0,
)

# Tavily search tool
search_tool = TavilySearchResults(max_results=5)

# Bind tools to model
tools = [search_tool]
model_with_tools = model.bind_tools(tools)
```

### Tools Available to the Agent

**Tavily Search** — LangChain's built-in Tavily integration. Requires `TAVILY_API_KEY` env var.

```python
search_tool = TavilySearchResults(
    max_results=5,
    description="Search the web for current information about German bureaucratic processes, legal requirements, deadlines, and consequences. Use German keywords for better results."
)
```

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

### LangGraph Agent Implementation

```python
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import SystemMessage, HumanMessage, AnyMessage
from typing import Annotated, Literal
import operator
from typing_extensions import TypedDict

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]

def llm_call(state: AgentState):
    return {"messages": [model_with_tools.invoke(state["messages"])]}

def tool_node(state: AgentState):
    results = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        result = tool.invoke(tool_call["args"])
        results.append(ToolMessage(content=str(result), tool_call_id=tool_call["id"]))
    return {"messages": results}

def should_continue(state: AgentState) -> Literal["tool_node", END]:
    if state["messages"][-1].tool_calls:
        return "tool_node"
    return END

# Build graph
graph = StateGraph(AgentState)
graph.add_node("llm_call", llm_call)
graph.add_node("tool_node", tool_node)
graph.add_edge(START, "llm_call")
graph.add_conditional_edges("llm_call", should_continue, ["tool_node", END])
graph.add_edge("tool_node", "llm_call")
agent = graph.compile()
```

### Streaming Behavior

The ReAct agent emits events in order:
1. `classification` — as soon as the letter type is determined
2. `risk_score` — risk level
3. `deadline` — extracted deadline info
4. `consequence` — what happens if missed

All four events fire after the agent concludes its reasoning loop and produces the final JSON.

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
langchain-openai       # ChatOpenAI for Qwen (OpenAI-compatible)
langchain-community    # TavilySearchResults tool
langchain-core         # Messages, tools
langgraph              # StateGraph agent framework
tavily-python          # Tavily search (needs TAVILY_API_KEY)
httpx                  # Direct API calls for OCR (Qwen-VL)
```

---

## Environment Variables

```
QWEN_API_KEY=<sponsor-provided>
QWEN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
TAVILY_API_KEY=<your-tavily-key>
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
| 1-2 | LangGraph agent setup — StateGraph with Tavily search tool |
| 2-3 | Agent prompt engineering — classification, deadline extraction |
| 3-4 | Consequence assessment, risk scoring prompts. Test diverse letter types |
| 4-5 | Integration with backend (expose async generator), integration with RAG (pass AgentResult) |
| 5-6 | Edge case testing, prompt tuning, demo preparation |
