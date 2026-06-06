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
