"""Extract outstanding EUR amounts from OCR'd German letters.

German letters cite amounts in many shapes:
- "€142.80" / "€ 142,80"
- "142,80 €" / "142,80€" / "142,80 EUR" / "142,80 Euro"
- "EUR 142.80" / "142.80 EUR"
- "Betrag: 142,80"
- "Forderung in Höhe von 142,80 EUR"
- "3.342,21 €" (Mahnungen routinely use a `.` thousands separator)
- "3 342,21 €" (rarer: space-as-thousands; we accept NBSP / thin space)

We extract candidate amounts via a tolerant regex and pick the most likely
"outstanding payment" — typically the largest amount in the document, since
balances dominate over per-item line entries on the kind of letters we
process (Mahnungen, Bescheide, Beitragsrechnungen).
"""

from __future__ import annotations

import logging
import re
from typing import Iterable

logger = logging.getLogger("klar.amounts")


# Thousands separator alternatives. Built explicitly so it survives editing.
# Includes: dot, comma, regular space, NBSP (U+00A0), thin space (U+2009).
_THOU_CHARS = ".,   "
_THOU_SEP = f"[{re.escape(_THOU_CHARS)}]"

# Inner numeric atom — matches either:
#   1.234,56  /  1,234.56  (thousands + decimal)
#   142,80    /  142.80    (just decimal)
#   142                    (bare integer)
_NUM = (
    rf"[0-9]{{1,3}}(?:{_THOU_SEP}[0-9]{{3}})*(?:[.,][0-9]{{2}})?"
    r"|\d+[.,]\d{2}"
    r"|\d+"
)

# Currency markers we accept after / before / around the number.
# - "€" the symbol
# - "EUR" the ISO code (lookahead: not followed by another letter, so this
#   doesn't match e.g. "EUROPA")
# - "Euro"/"EURO" the German word (same lookahead — avoids "Europa")
_CUR = r"€|EUR(?![A-Za-z])|Euro(?![A-Za-z])"

# German keywords that, in a Mahnung/Bescheid, virtually always precede the
# outstanding balance. Fallback for when the OCR omitted the currency marker.
_PAYMENT_KW = (
    r"(?:Forderung|Forderungsbetrag|Beitragsr[üu]ckstand|R[üu]ckstand|"
    r"Gesamtbetrag|Gesamtforderung|Zahlbetrag|offener\s+Betrag|"
    r"H[öo]he\s+von|in\s+H[öo]he\s+von|Summe|F[äa]llig(?:keits)?betrag|"
    r"zu\s+zahlen(?:der\s+Betrag)?|Betrag|S[äa]umniszuschlag|Mahngeb[üu]hr)"
)

_PATTERNS = [
    # €142.80   €142,80   € 142,80   €3.342,21
    re.compile(rf"€\s*({_NUM})", re.IGNORECASE),
    # 142,80 €  142,80€   1.234,56 EUR   3.342,21 Euro
    re.compile(rf"({_NUM})\s*(?:{_CUR})", re.IGNORECASE),
    # EUR 142,80  / EUR 1.234,56  / Euro 3.342,21
    re.compile(rf"(?:{_CUR})\s+({_NUM})", re.IGNORECASE),
    # Forderung: 3.342,21       offener Betrag von 142,80
    # Fallback for when the OCR dropped the € symbol entirely. The trailing
    # lookbehind forces the number to end in `,xx` / `.xx` so we don't pick
    # up bare integers (years, reference IDs).
    re.compile(
        rf"\b{_PAYMENT_KW}\b[^\d]{{0,30}}({_NUM}(?<=[.,][0-9]{{2}}))",
        re.IGNORECASE,
    ),
]


def _parse_german_decimal(raw: str) -> float | None:
    """Coerce a numeric string in German OR English format to float.

    Heuristic: if the LAST separator is a comma, treat as German decimal
    (thousands=., decimal=,). Otherwise treat as English (thousands=,
    decimal=.). Strip any space-as-thousands separator first so the LAST
    separator check sees only `.` and `,`.
    """
    # Drop every flavor of space (regular, NBSP, thin) used as a thousands sep.
    cleaned = raw.translate({ord(c): None for c in "   "}).strip()
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
    if not text:
        logger.info("amount extractor: empty input text")
        return None
    candidates = list(iter_amount_candidates(text))
    if not candidates:
        # Log a tight slice so we can see what the OCR looked like if the
        # extractor misses. We log the head AND tail since amounts often live
        # in the body / table near the bottom of a Mahnung.
        head = text[:600].replace("\n", " ")
        tail = text[-600:].replace("\n", " ") if len(text) > 1200 else ""
        logger.warning(
            "amount extractor: no €/EUR amount found in %d chars of OCR\n"
            "  HEAD: %r\n  TAIL: %r",
            len(text),
            head,
            tail,
        )
        return None
    primary = max(candidates)
    logger.info(
        "amount extractor: chose %.2f from %d candidate(s) %s",
        primary,
        len(candidates),
        sorted(candidates),
    )
    return primary
