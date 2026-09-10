"""Unit tests for backend/app/services/urgency.py — pure functions, no DB.

Covers the 4 required cases (tracker KLAR-T3 acceptance criterion 4):
  - red   (near/overdue deadline)
  - yellow (8-21 days out)
  - green (>21 days out)
  - green (no deadline)

Boundary values (7, 8, 21, 22) are asserted directly per criterion 2.
Dates are computed relative to `date.today()` so tests are never date-flaky.
"""

from datetime import date, timedelta

from app.services.urgency import compute_days_remaining, compute_urgency


def _in(days: int) -> date:
    return date.today() + timedelta(days=days)


def test_red_at_seven_days_boundary():
    deadline = _in(7)
    assert compute_days_remaining(deadline) == 7
    assert compute_urgency(deadline) == "red"


def test_red_when_overdue():
    deadline = _in(-3)
    assert compute_days_remaining(deadline) == -3
    assert compute_urgency(deadline) == "red"


def test_yellow_at_eight_days_boundary():
    deadline = _in(8)
    assert compute_days_remaining(deadline) == 8
    assert compute_urgency(deadline) == "yellow"


def test_yellow_at_twenty_one_days_boundary():
    deadline = _in(21)
    assert compute_days_remaining(deadline) == 21
    assert compute_urgency(deadline) == "yellow"


def test_green_at_twenty_two_days_boundary():
    deadline = _in(22)
    assert compute_days_remaining(deadline) == 22
    assert compute_urgency(deadline) == "green"


def test_green_when_no_deadline():
    assert compute_days_remaining(None) is None
    assert compute_urgency(None) == "green"
