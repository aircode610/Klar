import json
import os
from typing import AsyncGenerator
from datetime import date, datetime

from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langchain_core.messages import HumanMessage
from langchain.agents import create_agent

from ai.react_agent.schemas import AgentEvent, AgentResult
from ai.react_agent.prompts import AGENT_SYSTEM_PROMPT

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)
# Use qwen3.7-plus for the agent — fast with good tool calling support
QWEN_AGENT_MODEL = os.environ.get("QWEN_AGENT_MODEL", "qwen3.7-plus")


def _build_agent():
    """Build and compile the LangGraph ReAct agent using langchain.agents.create_agent."""
    model = ChatOpenAI(
        model=QWEN_AGENT_MODEL,
        api_key=DASHSCOPE_API_KEY,
        base_url=QWEN_API_BASE,
        temperature=0,
        max_tokens=4096,
    )

    search_tool = TavilySearch(
        max_results=3,
        description=(
            "Search the web for current information about German bureaucratic "
            "processes, legal requirements, deadlines, and consequences. "
            "Use German keywords for better results."
        ),
    )

    agent = create_agent(
        model=model,
        tools=[search_tool],
        system_prompt=AGENT_SYSTEM_PROMPT,
    )

    return agent


# Build once at import time
_agent = _build_agent()


# --- Output Parsing ---

def parse_agent_result(content: str, ocr_text: str) -> AgentResult:
    """Parse the agent's final JSON output into an AgentResult."""
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


# --- Public API ---

async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]:
    """
    Run the LangGraph ReAct agent. Yields AgentEvents when complete.
    Uses Tavily search to gather information about the letter.
    """
    try:
        result = await _agent.ainvoke({
            "messages": [
                HumanMessage(content=f"Analyze this German official letter:\n\n{ocr_text}"),
            ],
        })

        # Get the final message content
        final_message = result["messages"][-1]
        content = final_message.content

        # Parse structured output
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

    except Exception as e:
        yield AgentEvent("error", {"message": f"Agent failed: {e}"})


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
