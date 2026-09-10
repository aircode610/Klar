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
from uuid import uuid4

from app.database import engine
from app.models import DocumentCategory, Letter, LetterStatus, User
from app.routers.letters import list_letters
from app.services.urgency import (
    compute_days_remaining,
    compute_urgency,
    urgency_for_deadline,
)
from sqlmodel import Session


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


# --------------------------------------------------------------------------
# Atomic (days_remaining, urgency) pair — Review 1 blocking issue 1.
#
# `urgency_for_deadline` must snapshot `date.today()` exactly once and derive
# both values from it, so the pair can never contradict itself even if a
# midnight rollover happens between what would otherwise be two separate
# `date.today()` calls (e.g. days_remaining=8 but urgency="red").
# --------------------------------------------------------------------------


def test_urgency_for_deadline_returns_consistent_pair_red():
    deadline = _in(7)
    days_remaining, urgency = urgency_for_deadline(deadline)
    assert days_remaining == 7
    assert urgency == "red"


def test_urgency_for_deadline_returns_consistent_pair_yellow():
    deadline = _in(8)
    days_remaining, urgency = urgency_for_deadline(deadline)
    assert days_remaining == 8
    assert urgency == "yellow"


def test_urgency_for_deadline_returns_consistent_pair_green():
    deadline = _in(22)
    days_remaining, urgency = urgency_for_deadline(deadline)
    assert days_remaining == 22
    assert urgency == "green"


def test_urgency_for_deadline_returns_consistent_pair_no_deadline():
    days_remaining, urgency = urgency_for_deadline(None)
    assert days_remaining is None
    assert urgency == "green"


def test_urgency_for_deadline_immune_to_simulated_midnight_rollover(monkeypatch):
    """Simulates the exact bug the atomic helper prevents.

    If `compute_days_remaining` and `urgency_from_days_remaining` each called
    `date.today()` independently, a clock that advances between the two calls
    could produce e.g. days_remaining=8 (computed against yesterday) paired
    with urgency derived against today's (later) date. `urgency_for_deadline`
    snapshots `today` once, so the pair is always self-consistent regardless
    of how many times the underlying clock is queried elsewhere.
    """
    import app.services.urgency as urgency_mod

    deadline = _in(8)  # 8 days from the real "today" -> yellow, not red.

    real_date = urgency_mod.date
    call_count = {"n": 0}

    class _RollingDate(real_date):
        @classmethod
        def today(cls):
            # First call (inside urgency_for_deadline) returns the real today;
            # any further call would return a day later, simulating a
            # midnight rollover mid-computation. Because urgency_for_deadline
            # only calls date.today() once, this rollover must never surface.
            call_count["n"] += 1
            if call_count["n"] == 1:
                return real_date.today()
            return real_date.today() + timedelta(days=1)

    monkeypatch.setattr(urgency_mod, "date", _RollingDate)

    days_remaining, urgency = urgency_for_deadline(deadline)
    assert call_count["n"] == 1
    assert days_remaining == 8
    assert urgency == "yellow"


# --------------------------------------------------------------------------
# Endpoint response shape — Review 1 blocking issue 2.
#
# Criterion 1 requires `GET /api/letters` items to include both
# `days_remaining` and `urgency`. This calls the `list_letters` handler
# directly (same pattern as `test_scanned_pdf_graceful.py`'s
# `_call_post_letter`) against real DB rows with varying deadlines, and
# asserts the returned `LetterListItem`s carry both fields with the right
# values — without spinning up a full HTTP/TestClient integration test.
# --------------------------------------------------------------------------


def _make_user(db: Session) -> User:
    user = User(email=f"urgency-{uuid4()}@example.com", language="en")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_letter(db: Session, user_id, *, deadline_date, letter_type="Formal Letter"):
    letter = Letter(
        user_id=user_id,
        language="en",
        status=LetterStatus.UPLOADED,
        original_file="/tmp/whatever.pdf",
        letter_type=letter_type,
        category=DocumentCategory.OTHER,
        deadline_date=deadline_date,
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)
    return letter


def test_list_letters_response_includes_days_remaining_and_urgency():
    with Session(engine) as db:
        user = _make_user(db)
        _make_letter(db, user.id, deadline_date=_in(3))   # red
        _make_letter(db, user.id, deadline_date=_in(10))  # yellow
        _make_letter(db, user.id, deadline_date=_in(30))  # green
        _make_letter(db, user.id, deadline_date=None)     # green, no deadline

        items = list_letters(status=None, category=None, db=db, user=user)

    by_deadline_days = {item.days_remaining: item for item in items}

    assert len(items) == 4
    for item in items:
        # Both fields must be present on every item (criterion 1) ...
        assert hasattr(item, "days_remaining")
        assert hasattr(item, "urgency")

    assert by_deadline_days[3].urgency == "red"
    assert by_deadline_days[10].urgency == "yellow"
    assert by_deadline_days[30].urgency == "green"
    assert by_deadline_days[None].urgency == "green"
