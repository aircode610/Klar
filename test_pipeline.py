"""
Full pipeline test: OCR → ReAct Agent → Response Generation
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
from ai.rag.generator import generate_response


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

    agent_result = get_last_agent_result(events, ocr_text)

    # --- Step 3: Response Generation ---
    print_header("STEP 3: Response Generation (Qwen + anti-hallucination)")
    t0 = time.time()
    rag_result = await generate_response(ocr_text, agent_result, language="en")
    gen_time = time.time() - t0

    print("  --- EXPLANATION ---")
    print(f"  {rag_result.explanation[:500]}")
    if len(rag_result.explanation) > 500:
        print(f"  ... [{len(rag_result.explanation)} chars total]")
    print()

    print("  --- RESPONSE DRAFT ---")
    print(f"  {rag_result.response_draft[:500]}")
    if len(rag_result.response_draft) > 500:
        print(f"  ... [{len(rag_result.response_draft)} chars total]")
    print()

    print("  --- CHECKLIST ---")
    for item in rag_result.checklist:
        print(f"    - {item}")
    print()

    print("  --- CITATIONS ---")
    for c in rag_result.citations:
        print(f"    {c.get('section', '?')}: {c.get('text', '')}")
    if not rag_result.citations:
        print("    (none — no RAG database loaded)")
    print()

    print(f"  Confidence: {rag_result.confidence}")
    print(f"  [Generation completed in {gen_time:.1f}s]")

    # --- Summary ---
    total_time = ocr_time + agent_time + gen_time
    print_header("TIMING SUMMARY")
    print(f"  OCR:        {ocr_time:.1f}s")
    print(f"  Agent:      {agent_time:.1f}s")
    print(f"  Generation: {gen_time:.1f}s")
    print(f"  Total:      {total_time:.1f}s")
    print(f"\n  Trace: https://eu.smith.langchain.com → project 'klar-hackathon'")
    print()


if __name__ == "__main__":
    asyncio.run(main())
