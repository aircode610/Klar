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


def compute_days_remaining(deadline_date: date | None, *, today: date | None = None) -> int | None:
    """None if no deadline; otherwise (deadline_date - today).days.

    May be negative if the deadline is already overdue. Pure calendar-day
    arithmetic via `date.today()` — matches the convention already used by
    `services/risk.py`'s `_deadline_proximity`.

    `today` may be passed explicitly so callers that also need `urgency` can
    snapshot "today" once and derive both values from it atomically (see
    `urgency_for_deadline`) instead of each function calling `date.today()`
    independently, which risks a midnight rollover producing contradictory
    days_remaining/urgency pairs.
    """
    if deadline_date is None:
        return None
    if today is None:
        today = date.today()
    return (deadline_date - today).days


def urgency_from_days_remaining(days_remaining: int | None) -> Urgency:
    """Derive the urgency color from an already-computed days_remaining.

    Pure function of the days value — no clock access — so it can never
    disagree with the days_remaining it was derived from.
    """
    if days_remaining is None:
        return "green"
    if days_remaining <= 7:
        return "red"
    if days_remaining <= 21:
        return "yellow"
    return "green"


def compute_urgency(deadline_date: date | None) -> Urgency:
    """red <= 7 days; yellow 8-21 days; green > 21 days or no deadline.

    Convenience wrapper for callers that only need the color, not the days
    count. Callers that need BOTH values for the same letter must use
    `urgency_for_deadline` instead, to guarantee they're computed against the
    same `today` snapshot.
    """
    return urgency_from_days_remaining(compute_days_remaining(deadline_date))


def urgency_for_deadline(deadline_date: date | None) -> tuple[int | None, Urgency]:
    """Compute (days_remaining, urgency) atomically from a single `today`.

    This is the function callers needing both fields (e.g. `GET /api/letters`)
    should use: it snapshots `date.today()` exactly once so the two returned
    values can never contradict each other across a midnight rollover.
    """
    today = date.today()
    days_remaining = compute_days_remaining(deadline_date, today=today)
    urgency = urgency_from_days_remaining(days_remaining)
    return days_remaining, urgency
