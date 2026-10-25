# ============================================================================
# FILE: app/absent_job/job.py
# PURPOSE: End-of-day job that marks staff "Absent" when they had no scan,
#          and flags missing clock-outs as "Incomplete".
# ----------------------------------------------------------------------------
# RULES:
#   - Runs after the last shift has ended + its grace period.
#   - For each ACTIVE staff member scheduled to work that day:
#       * skip if there is ANY attendance record for that day (present/late),
#       * skip if the day is a holiday or a non-working day for their shift,
#       * skip if they are on APPROVED leave,
#       * otherwise create an "Absent" record.
#   - Night shifts are attributed to the day the shift STARTED.
#   - Idempotent: safe to run twice (unique (staff_id, date) + existence check).
#   - Also flags records that have time_in but no time_out as "Incomplete".
#   - Writes one audit log entry per run with counts.
# ============================================================================
from datetime import date as date_cls
from app.extensions import db
from app.models import Staff, Attendance, LeaveRequest
from app.utils.calendar_rules import is_working_day
from app.utils.audit import record_audit


def mark_absentees_for_date(target: date_cls, actor_user_id=None) -> dict:
    """
    Process a single date. Returns a summary dict:
      { date, absent_created, incomplete_flagged, skipped }
    """
    absent_created = 0
    incomplete_flagged = 0
    skipped = 0

    active_staff = Staff.query.filter_by(status="Active").all()

    for s in active_staff:
        # Working-day / holiday check (per-shift working days respected).
        if not is_working_day(target, s.shift):
            skipped += 1
            continue

        existing = Attendance.query.filter_by(staff_id=s.staff_id, date=target).first()

        if existing:
            # They scanned. If they clocked in but never out, flag Incomplete.
            if existing.time_in and not existing.time_out and existing.status != "Incomplete":
                existing.status = "Incomplete"
                incomplete_flagged += 1
            continue

        # No record. Skip if on approved leave.
        if LeaveRequest.on_approved_leave(s.staff_id, target):
            skipped += 1
            continue

        # Create the Absent record (idempotent thanks to the uniqueness check).
        db.session.add(Attendance(
            staff_id=s.staff_id, date=target, time_in=None, time_out=None,
            status="Absent", verification_method="Auto",
        ))
        absent_created += 1

    db.session.commit()

    summary = {
        "date": target.isoformat(),
        "absent_created": absent_created,
        "incomplete_flagged": incomplete_flagged,
        "skipped": skipped,
    }
    record_audit(
        "ABSENT_JOB_RUN", "attendance",
        f"{target.isoformat()}: {absent_created} absent, "
        f"{incomplete_flagged} incomplete, {skipped} skipped",
        user_id=actor_user_id,
    )
    return summary
