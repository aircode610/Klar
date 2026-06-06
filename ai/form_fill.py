"""
Form-fill: use Qwen-VL to detect blank fields + coordinates,
then Pillow to draw red placeholder text at exact positions.

Two-step approach:
1. LLM call: Qwen-VL reads the image, returns JSON array of {x, y, width, height, label, placeholder}
2. Pillow: draws the placeholder text at those coordinates on the original image

Coordinates are in pixels relative to the original image dimensions.
"""

import base64
import json
import os
from io import BytesIO

import httpx
from PIL import Image, ImageDraw, ImageFont

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_API_BASE = os.environ.get(
    "QWEN_API_BASE", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

DETECT_PROMPT = """This is a German letter with a form section. Find ONLY the empty blank lines/boxes where a person must handwrite their information.

Rules:
- ONLY detect genuinely EMPTY fields (blank lines, empty boxes). NEVER include fields that already have printed text.
- Return coordinates as percentage of image dimensions (0-100), NOT pixels.
- x is percentage from left edge, y is percentage from top edge.
- w and h are percentage of image width/height.

Return a JSON array ONLY. Each object has exactly these keys:
{"x": number, "y": number, "w": number, "h": number, "label": "German field name", "placeholder": "English text to write"}

Only return the JSON array, nothing else."""


async def _detect_fields(image_path: str) -> list[dict]:
    """Call Qwen-VL to detect blank form fields and their pixel coordinates."""
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    b64 = base64.b64encode(image_bytes).decode()
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{QWEN_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
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
                                "image_url": {"url": f"data:{mime};base64,{b64}"},
                            },
                            {"type": "text", "text": DETECT_PROMPT},
                        ],
                    }
                ],
                "temperature": 0,
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]

    # Parse JSON — model may wrap in markdown, add commentary, use single quotes, etc.
    text = raw.strip()

    # Strip markdown fences
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            stripped = part.strip()
            if stripped.lower().startswith("json"):
                stripped = stripped[4:].strip()
            if stripped.startswith("["):
                text = stripped
                break

    # Find the JSON array in the text
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        return []

    json_str = text[start:end + 1]

    import re
    # Fix common LLM JSON issues
    json_str = json_str.replace("'", '"')
    # Remove trailing commas before } or ]
    json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
    # Fix "x": 134, 186 → "x": 134 (take first number only)
    json_str = re.sub(r'"(x|y|w|h)":\s*(\d+(?:\.\d+)?),\s*\d+(?:\.\d+)?', r'"\1": \2', json_str)

    try:
        fields = json.loads(json_str)
    except json.JSONDecodeError:
        return []

    if not isinstance(fields, list):
        return []
    return fields


def _draw_placeholders(image_path: str, fields: list[dict]) -> bytes:
    """Draw red placeholder text on the original image using Pillow."""
    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Try to load a decent font, fall back to default
    font_size = max(16, img.height // 60)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    red = (220, 38, 38)  # Tailwind red-600

    img_w, img_h = img.size

    for field in fields:
        try:
            # Convert percentage coordinates to pixels
            x = int(float(field["x"]) / 100 * img_w)
            y = int(float(field["y"]) / 100 * img_h)
            w = int(float(field.get("w", 20)) / 100 * img_w)
            h = int(float(field.get("h", 3)) / 100 * img_h)
            placeholder = str(field.get("placeholder", "FILL IN"))

            # Clamp to image bounds
            x = max(0, min(x, img_w - 10))
            y = max(0, min(y, img_h - 10))
            w = min(w, img_w - x)
            h = max(h, font_size + 6)

            # Draw a light red background to highlight the field
            draw.rectangle(
                [x, y, x + w, y + h],
                fill=(255, 235, 235, 200),
                outline=red,
                width=2,
            )

            # Draw the placeholder text centered vertically in the field
            text_y = y + max(0, (h - font_size) // 2)
            draw.text((x + 6, text_y), placeholder, fill=red, font=font)

        except (KeyError, ValueError, TypeError):
            continue

    buf = BytesIO()
    img.save(buf, format="PNG", quality=95)
    return buf.getvalue()


async def generate_filled_form(
    image_path: str,
    placeholders: list[str],
) -> bytes:
    """
    1. Qwen-VL detects blank fields and their pixel coordinates
    2. Pillow draws red placeholder text at those exact positions

    The `placeholders` arg from the backend is used as context but
    the LLM decides the actual field positions from the image.
    """
    fields = await _detect_fields(image_path)

    if not fields:
        # Fallback: if detection fails, return original image unchanged
        with open(image_path, "rb") as f:
            return f.read()

    return _draw_placeholders(image_path, fields)
