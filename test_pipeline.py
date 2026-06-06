"""
Full pipeline test: OCR → ReAct Agent
Traces to LangSmith EU for observability.

Usage: python test_pipeline.py [image_path]
Default: data/insurance-test.jpg
"""

import asyncio
import json
import os
import sys
import time

# --- LangSmith EU tracing setup (must be before any langchain imports) ---
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_ENDPOINT"] = "https://eu.api.smith.langchain.com"
os.environ["LANGCHAIN_PROJECT"] = "klar-hackathon"

from ai.react_agent.ocr import extract_text_from_image
from ai.react_agent.agent import run_react_agent, get_last_agent_result


def print_header(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_event(event):
    data_str = json.dumps(event.data, indent=2, ensure_ascii=False)
    print(f"  [{event.type}]")
    for line in data_str.split("\n"):
        print(f"    {line}")
    print()


async def main():
    image_path = sys.argv[1] if len(sys.argv) > 1 else "data/insurance-test.jpg"

    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        sys.exit(1)

    print_header("KLAR PIPELINE TEST")
    print(f"  Image: {image_path}")
    print(f"  LangSmith: {os.environ.get('LANGCHAIN_ENDPOINT')}")
    print(f"  Project:   {os.environ.get('LANGCHAIN_PROJECT')}")

    # --- Step 1: OCR ---
    print_header("STEP 1: OCR (Qwen-VL-OCR)")
    t0 = time.time()
    ocr_text = await extract_text_from_image(image_path)
    ocr_time = time.time() - t0
    print(ocr_text)
    print(f"\n  [{len(ocr_text)} chars in {ocr_time:.1f}s]")

    # --- Step 2: ReAct Agent ---
    print_header("STEP 2: ReAct Agent (LangGraph + Qwen + Tavily)")
    t0 = time.time()
    events = []
    async for event in run_react_agent(ocr_text):
        print_event(event)
        events.append(event)
    agent_time = time.time() - t0
    print(f"  [Agent completed in {agent_time:.1f}s]")

    # --- Summary ---
    result = get_last_agent_result(events, ocr_text)
    print_header("SUMMARY")
    print(f"  Letter Type:  {result.letter_type}")
    print(f"  Agency:       {result.agency}")
    print(f"  Deadline:     {result.deadline_date or 'None'}")
    print(f"  Days Left:    {result.days_remaining or 'N/A'}")
    print(f"  Risk Score:   {result.risk_score}/5 ({result.risk_label})")
    print(f"  Consequence:  {result.consequence[:150]}...")
    print()
    print(f"  Total time:   {ocr_time + agent_time:.1f}s")
    print(f"  Trace:        https://eu.smith.langchain.com → project 'klar-hackathon'")
    print()


if __name__ == "__main__":
    asyncio.run(main())
