import os
from typing import AsyncGenerator
from datetime import date, datetime

from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langchain_core.messages import HumanMessage
from langchain.agents import create_agent

from ai.react_agent.schemas import AgentEvent, AgentResult, AgentAnalysis
from ai.prompts import AGENT_SYSTEM_PROMPT

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)
QWEN_AGENT_MODEL = os.environ.get("QWEN_AGENT_MODEL", "qwen3.7-plus")


def _build_agent():
    """Build the LangGraph ReAct agent with structured output via response_format."""
    model = ChatOpenAI(
        model=QWEN_AGENT_MODEL,
        api_key=DASHSCOPE_API_KEY,
        base_url=QWEN_API_BASE,
        temperature=0,
        max_tokens=4096,
        extra_body={"enable_thinking": False},
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
        response_format=AgentAnalysis,
    )

    return agent


_agent = _build_agent()


async def run_react_agent(ocr_text: str) -> AsyncGenerator[AgentEvent, None]:
    """
    Run the LangGraph ReAct agent. Yields AgentEvents when complete.
    Output is structured via response_format — no manual JSON parsing.
    """
    try:
        result = await _agent.ainvoke({
            "messages": [
                HumanMessage(content=f"Analyze this German official letter:\n\n{ocr_text}"),
            ],
        })

        # create_agent with response_format puts the parsed object in structured_response
        analysis: AgentAnalysis = result["structured_response"]

        # Calculate days_remaining if not provided
        days_remaining = analysis.deadline.days_remaining
        if analysis.deadline.date and days_remaining is None:
            try:
                dl = datetime.strptime(analysis.deadline.date, "%Y-%m-%d").date()
                days_remaining = (dl - date.today()).days
            except ValueError:
                pass

        yield AgentEvent("classification", {
            "type": analysis.classification.type,
            "agency": analysis.classification.agency,
        })
        yield AgentEvent("risk_score", {
            "score": analysis.risk_score.score,
            "label": analysis.risk_score.label,
        })
        if analysis.deadline.date:
            yield AgentEvent("deadline", {
                "date": analysis.deadline.date,
                "days_remaining": days_remaining,
            })
        yield AgentEvent("consequence", {
            "text": analysis.consequence.text,
        })

    except Exception as e:
        yield AgentEvent("error", {"message": f"Agent failed: {e}"})


def get_last_agent_result(events: list[AgentEvent], ocr_text: str) -> AgentResult:
    """Reconstruct an AgentResult from collected events."""
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
