"""
Form-fill: take the original letter image, overlay placeholder text
on fields that need user input, return the annotated image.

Uses Qwen image editing (qwen-image-2.0) via DashScope multimodal API.
"""

import base64
import os

import httpx

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_INTL_URL = (
    "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
)


async def generate_filled_form(
    image_path: str,
    placeholders: list[str],
) -> bytes:
    """
    Takes the original letter image and a list of placeholder instructions,
    calls Qwen image edit to overlay the placeholders, returns the result as PNG bytes.

    Args:
        image_path: path to the original letter image on disk
        placeholders: list of field descriptions, e.g.
            ["IBAN: DExx xxxx xxxx xxxx xx", "Name: [Vor- und Nachname]"]

    Returns:
        PNG image bytes of the annotated form
    """
    # Read and encode the source image
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    b64 = base64.b64encode(image_bytes).decode()

    ext = image_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")
    data_url = f"data:{mime};base64,{b64}"

    # Build the edit instruction
    fields = "\n".join(f"- {p}" for p in placeholders)
    instruction = (
        "This is a German official letter/form. Add clear placeholder text in bright red "
        "handwriting style directly onto the blank fields or lines where the user needs to "
        "fill in their information. Write these placeholders:\n"
        f"{fields}\n\n"
        "Place each placeholder exactly where it belongs on the form. "
        "Keep the rest of the document completely unchanged. "
        "Make the placeholder text clearly visible but obviously not real data."
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            DASHSCOPE_INTL_URL,
            headers={
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen-image-2.0",
                "input": {
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"image": data_url},
                                {"text": instruction},
                            ],
                        }
                    ]
                },
                "parameters": {
                    "watermark": False,
                    "n": 1,
                },
            },
        )
        resp.raise_for_status()
        result = resp.json()

    # The API returns a URL to the generated image
    image_url = result["output"]["choices"][0]["message"]["content"][0]["image"]

    # Download the result image
    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        return img_resp.content
