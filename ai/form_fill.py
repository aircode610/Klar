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

# Standard placeholder patterns for common German form fields
PLACEHOLDER_MAP = {
    "iban": "DE__ ____ ____ ____ ____ __",
    "name": "YOUR FULL NAME",
    "vorname": "YOUR FIRST NAME",
    "nachname": "YOUR LAST NAME",
    "anschrift": "YOUR STREET, ZIP, CITY",
    "adresse": "YOUR STREET, ZIP, CITY",
    "telefon": "+49 ___ ________",
    "e-mail": "your@email.com",
    "email": "your@email.com",
    "steuernummer": "XX/XXX/XXXXX",
    "steuer-id": "00 000 000 000",
    "datum": "DD.MM.YYYY",
    "date": "DD.MM.YYYY",
    "unterschrift": "SIGN HERE ✍",
    "signature": "SIGN HERE ✍",
    "versichertennummer": "X000000000",
    "aktenzeichen": "REFERENCE NUMBER",
    "anzahl": "NUMBER",
    "belege": "NUMBER OF DOCUMENTS",
    "ort": "CITY",
}


def _build_field_instructions(placeholders: list[str]) -> str:
    """Build explicit per-field instructions for the image editor."""
    lines = []
    for p in placeholders:
        p_lower = p.lower()
        # Find matching placeholder pattern
        matched = False
        for key, value in PLACEHOLDER_MAP.items():
            if key in p_lower:
                lines.append(f'In the "{p}" field, write exactly: {value}')
                matched = True
                break
        if not matched:
            lines.append(f'In the "{p}" field, write exactly: FILL IN HERE')
    return "\n".join(lines)


async def generate_filled_form(
    image_path: str,
    placeholders: list[str],
) -> bytes:
    """
    Takes the original letter image and a list of placeholder instructions,
    calls Qwen image edit to overlay the placeholders, returns the result as PNG bytes.
    """
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    b64 = base64.b64encode(image_bytes).decode()

    ext = image_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")
    data_url = f"data:{mime};base64,{b64}"

    field_instructions = _build_field_instructions(placeholders)

    instruction = (
        "This is a scanned German official letter with a form section that has empty fields. "
        "Write placeholder text IN ENGLISH in bright red ink directly into each empty field/line on the form. "
        "The placeholder text must be clearly readable and tell the user what to fill in.\n\n"
        "IMPORTANT RULES:\n"
        "- Write ONLY in English\n"
        "- Use bright red color for all placeholder text\n"
        "- Write directly ON the blank lines/boxes in the form\n"
        "- Do NOT change any existing printed text\n"
        "- Keep the rest of the document exactly as it is\n\n"
        "Fill in these specific fields:\n"
        f"{field_instructions}"
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

    image_url = result["output"]["choices"][0]["message"]["content"][0]["image"]

    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        return img_resp.content
