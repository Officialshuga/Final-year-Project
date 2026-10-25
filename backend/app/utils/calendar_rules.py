# ============================================================================
# FILE: app/utils/calendar_rules.py
# PURPOSE: Central rules for whether a given date is a WORKING day for a staff
#          member. Used by the absent-marking job AND reports so behaviour is
#          consistent everywhere (non-working days / holidays are never absent).
# ============================================================================
from app.models import Setting, Holiday


def is_working_day(d, shift=None) -> bool:
    """
    True if date `d` is a working day.
    - Not a public holiday, AND
    - Its weekday is in the working-days set (per-shift override, else org-wide).
    """
    if Holiday.is_holiday(d):
        return False
    # Per-shift working days take priority if configured.
    days = None
    if shift is not None:
        days = shift.working_days_list()
    if days is None:
        days = Setting.working_days()
    return d.weekday() in days


def day_kind(d, shift=None) -> str:
    """Classify a day for calendars/reports: holiday | non-working | working."""
    if Holiday.is_holiday(d):
        return "holiday"
    days = (shift.working_days_list() if shift else None) or Setting.working_days()
    return "working" if d.weekday() in days else "non-working"
