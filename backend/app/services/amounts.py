"""Extract outstanding EUR amounts from OCR'd German letters.

German letters cite amounts in many shapes:
- "€142.80" / "€ 142,80"
- "142,80 €" / "142,80€" / "142,80 EUR"
- "EUR 142.80" / "142.80 EUR"
- "Betrag: 142,80"
- "Forderung in Höhe von 142,80 EUR"

We extract candidate amounts via a tolerant regex and pick the most likely
"outstanding payment" — typically the largest amount in the document, since
balances dominate over per-item line entries on the kind of letters we
process (Mahnungen, Bescheide, Beitragsrechnungen).
"""

from __future__ import annotations

import re
from typing import Iterable


# Match amounts in either German (1.234,56) or English (1,234.56) format.
# Three patterns to cover where the € symbol can sit.
_PATTERNS = [
    # €142.80   €142,80   € 142,80
    re.compile(
        r"€\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|\d+[.,]\d{2}|\d+)",
        re.IGNORECASE,
    ),
    # 142,80 €  142,80€   1.234,56 EUR
    re.compile(
        r"\b([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|\d+[.,]\d{2}|\d+)\s*(?:€|EUR\b)",
        re.IGNORECASE,
    ),
    # EUR 142,80  / EUR 1.234,56
    re.compile(
        r"\bEUR\s+([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|\d+[.,]\d{2}|\d+)",
        re.IGNORECASE,
    ),
]


def _parse_german_decimal(raw: str) -> float | None:
    """Coerce a numeric string in German OR English format to float.

    Heuristic: if the LAST separator is a comma, treat as German decimal
    (thousands=., decimal=,). Otherwise treat as English (thousands=,
    decimal=.).
    """
    cleaned = raw.strip()
    if not cleaned:
        return None
    last_dot = cleaned.rfind(".")
    last_comma = cleaned.rfind(",")
    try:
        if last_comma > last_dot:
            # German: 1.234,56 → 1234.56
            return float(cleaned.replace(".", "").replace(",", "."))
        # English: 1,234.56 → 1234.56
        return float(cleaned.replace(",", ""))
    except ValueError:
        return None


def iter_amount_candidates(text: str) -> Iterable[float]:
    """Yield every plausible EUR amount detected in `text`."""
    if not text:
        return
    seen: set[float] = set()
    for pat in _PATTERNS:
        for m in pat.finditer(text):
            amt = _parse_german_decimal(m.group(1))
            if amt is None or amt <= 0:
                continue
            # Filter out implausible "amounts" likely to be reference numbers
            # (e.g. an 8-digit IBAN fragment): cap at €1,000,000.
            if amt > 1_000_000:
                continue
            # De-dupe on the rounded value so 142.8 / 142.80 don't double up.
            key = round(amt, 2)
            if key in seen:
                continue
            seen.add(key)
            yield amt


def primary_outstanding_amount(text: str) -> float | None:
    """Pick the most likely outstanding amount from `text`.

    Heuristic: the largest plausible EUR amount in the document. On
    Mahnungen / Bescheide the headline balance is almost always the largest
    number; per-item fees and the Mahngebühr come in smaller. Returns None
    if no amount is found.
    """
    candidates = list(iter_amount_candidates(text))
    if not candidates:
        return None
    return max(candidates)
