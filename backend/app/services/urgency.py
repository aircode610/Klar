"""Shared urgency computation — canonical thresholds for red/yellow/green.

Computed at read time from `Letter.deadline_date`; never persisted. This is
the single source of truth for the urgency thresholds so callers (currently
`GET /api/letters`'s `list_letters`, and later KLAR-T2's SSE `urgency` event)
derive the same color from the same days-remaining calculation instead of
duplicating the boundary logic.

Thresholds:
  - red:    days_remaining <= 7 (including negative/overdue values)
  - yellow: 8 <= days_remaining <= 21
  - green:  days_remaining > 21, OR deadline_date is None
"""

from datetime import date
from typing import Literal

Urgency = Literal["red", "yellow", "green"]


def compute_days_remaining(deadline_date: date | None) -> int | None:
    """None if no deadline; otherwise (deadline_date - today).days.

    May be negative if the deadline is already overdue. Pure calendar-day
    arithmetic via `date.today()` — matches the convention already used by
    `services/risk.py`'s `_deadline_proximity`.
    """
    if deadline_date is None:
        return None
    return (deadline_date - date.today()).days


def compute_urgency(deadline_date: date | None) -> Urgency:
    """red <= 7 days; yellow 8-21 days; green > 21 days or no deadline."""
    days_remaining = compute_days_remaining(deadline_date)
    if days_remaining is None:
        return "green"
    if days_remaining <= 7:
        return "red"
    if days_remaining <= 21:
        return "yellow"
    return "green"
