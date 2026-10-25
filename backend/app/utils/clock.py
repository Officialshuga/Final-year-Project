# ============================================================================
# FILE: app/utils/clock.py
# PURPOSE: Single source of truth for TIME on the server.
# ----------------------------------------------------------------------------
# RULES:
#   - All attendance timestamps come from the SERVER clock (never the browser,
#     phone, or scanner). Frontend-supplied times are always ignored.
#   - We store everything in UTC and only convert to the organisation timezone
#     (Africa/Lagos) for display.
# ============================================================================
from datetime import datetime, timezone, timedelta

# Africa/Lagos is UTC+01:00 all year (no daylight saving). Using a fixed offset
# avoids a hard dependency on the system tz database / zoneinfo.
LAGOS = timezone(timedelta(hours=1), name="Africa/Lagos")


def now_utc() -> datetime:
    """Current moment in UTC (timezone-aware). THE authoritative server time."""
    return datetime.now(timezone.utc)


def to_lagos(dt: datetime) -> datetime:
    """Convert any datetime to Africa/Lagos for display."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)  # assume stored values are UTC
    return dt.astimezone(LAGOS)


def lagos_now() -> datetime:
    """Current wall-clock time in Lagos (for 'today' and shift comparisons)."""
    return to_lagos(now_utc())


def lagos_date():
    """Today's date in the organisation timezone."""
    return lagos_now().date()


def lagos_time():
    """Current time-of-day in the organisation timezone (no microseconds)."""
    return lagos_now().time().replace(microsecond=0)


def iso_utc(dt: datetime | None) -> str | None:
    """Serialise a datetime as a UTC ISO string for the API."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()
