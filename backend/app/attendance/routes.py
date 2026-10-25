# ============================================================================
# BLUEPRINT: attendance  (prefix: /api/attendance)
# ----------------------------------------------------------------------------
# KEY ENDPOINT:  POST /api/attendance/scan
#   1. Receives a fingerprint template (from kiosk/reader).
#   2. Matches it against ALL stored (encrypted) templates using BiometricService.
#   3. Identifies the staff member with the best score above MATCH_THRESHOLD.
#   4. First scan of the day  -> records time_in (+ Present/Late by shift grace).
#      Later scan same day     -> records time_out.
#      Prevents duplicate sign-ins.
#   5. Returns staff name, status and time.
#
# Also: GET /api/attendance   (admin: all + filters; staff: own only)
# ============================================================================
from datetime import timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import Attendance, Staff, BiometricTemplate
from app.utils.security import roles_required, current_user, ensure_self_or_admin
from app.utils.audit import record_audit
from app.utils.crypto import decrypt_bytes
from app.utils.clock import lagos_now, lagos_date
from app.biometrics.service import get_biometric_service

attendance_bp = Blueprint("attendance", __name__, url_prefix="/api/attendance")


def _status_for_checkin(staff: Staff, now_time) -> str:
    """Present if on/before the shift grace cutoff, else Late."""
    if staff.shift:
        return "Late" if now_time > staff.shift.late_cutoff() else "Present"
    return "Present"


def _attendance_day(staff: Staff, now_local):
    """
    Decide which calendar day a scan belongs to.
    For a NIGHT shift that crosses midnight (start_time > end_time), a scan in
    the early morning (before the end_time) is attributed to the PREVIOUS day,
    i.e. the day the shift STARTED.
    """
    today = now_local.date()
    shift = staff.shift
    if shift and shift.start_time > shift.end_time:
        # Night shift. If we're past midnight but before the shift end, the
        # work day started yesterday.
        if now_local.time() <= shift.end_time:
            return today - timedelta(days=1)
    return today


# ----------------------------------------------------------------------------
# SCAN — identify by fingerprint, then clock in or out.
# Body: { "template": "<string from reader>" }
# This route is typically called by the kiosk terminal. It does not require a
# staff JWT (the fingerprint IS the identity), but we keep it protected so only
# an authenticated operator/kiosk account can submit scans.
# ----------------------------------------------------------------------------
@attendance_bp.post("/scan")
@jwt_required()
@roles_required("admin", "staff")
def scan():
    data = request.get_json(silent=True) or {}
    template_str = data.get("template")
    if not template_str:
        return jsonify({"error": "Validation", "message": "template is required"}), 400
    # SECURITY: any time value sent by the client is explicitly IGNORED.
    # The authoritative timestamp always comes from the server clock below.
    data.pop("time", None)
    data.pop("timestamp", None)

    probe = template_str.encode() if isinstance(template_str, str) else bytes(template_str)
    service = get_biometric_service()
    threshold = current_app.config["MATCH_THRESHOLD"]

    # --- 1:N identification against stored templates ---
    # Use the in-memory cache of DECRYPTED templates for speed (rebuilt only
    # when enrolment changes). Templates stay in RAM, never logged or returned.
    from app.biometrics.template_cache import load_templates
    best_staff_id, best_score = None, -1
    for sid, candidate in load_templates():
        score = service.match(probe, candidate)
        if score > best_score:
            best_score, best_staff_id = score, sid

    if best_staff_id is None or best_score < threshold:
        record_audit("SCAN_UNKNOWN", "attendance", f"No match (best score {max(best_score,0)})")
        return jsonify({"error": "NoMatch",
                        "message": "Fingerprint not recognised",
                        "score": max(best_score, 0)}), 404

    staff = Staff.query.get(best_staff_id)
    if not staff or staff.status != "Active":
        return jsonify({"error": "Inactive", "message": "Matched an inactive staff record"}), 403

    # Authoritative SERVER time (organisation timezone), never the device's.
    now_local = lagos_now()
    now_time = now_local.time().replace(microsecond=0)
    today = _attendance_day(staff, now_local)  # night-shift aware
    record = Attendance.query.filter_by(staff_id=staff.staff_id, date=today).first()

    # --- First scan today -> CLOCK IN ---
    if not record:
        status = _status_for_checkin(staff, now_time)
        record = Attendance(
            staff_id=staff.staff_id, date=today, time_in=now_time,
            status=status, verification_method="Fingerprint",
        )
        db.session.add(record)
        db.session.commit()
        record_audit("CHECK_IN", "attendance",
                     f"{staff.full_name} clocked in ({status}) at {now_time.strftime('%H:%M')}",
                     user_id=staff.user.user_id if staff.user else None)
        return jsonify({
            "action": "check_in", "staff_name": staff.full_name,
            "staff_number": staff.staff_number,
            "department": staff.department.name if staff.department else None,
            "status": status, "time": now_time.strftime("%H:%M"),
            "match_score": best_score,
            "message": f"Welcome, {staff.full_name}. Marked {status}.",
        }), 200

    # --- Already clocked in but not out -> CLOCK OUT ---
    if record.time_in and not record.time_out:
        record.time_out = now_time
        db.session.commit()
        record_audit("CHECK_OUT", "attendance",
                     f"{staff.full_name} clocked out at {now_time.strftime('%H:%M')}",
                     user_id=staff.user.user_id if staff.user else None)
        return jsonify({
            "action": "check_out", "staff_name": staff.full_name,
            "staff_number": staff.staff_number,
            "status": record.status, "time": now_time.strftime("%H:%M"),
            "hours_worked": record.hours_worked(), "match_score": best_score,
            "message": f"Goodbye, {staff.full_name}. Have a good day.",
        }), 200

    # --- Already clocked in AND out -> duplicate ---
    return jsonify({
        "action": "duplicate", "staff_name": staff.full_name,
        "status": record.status,
        "time_in": record.time_in.strftime("%H:%M") if record.time_in else None,
        "time_out": record.time_out.strftime("%H:%M") if record.time_out else None,
        "message": f"{staff.full_name} has already clocked in and out today.",
    }), 409


# ----------------------------------------------------------------------------
# MANUAL ATTENDANCE (fallback when the sensor is disconnected) — ADMIN ONLY.
# A reason is REQUIRED and recorded. Uses server time; respects clock-in/out and
# duplicate rules just like the fingerprint scan.
# Body: { staff_id, reason, action? ("check_in"|"check_out", auto if omitted) }
# ----------------------------------------------------------------------------
@attendance_bp.post("/manual")
@jwt_required()
@roles_required("admin")
def manual_attendance():
    data = request.get_json(silent=True) or {}
    staff_id = data.get("staff_id")
    reason = (data.get("reason") or "").strip()
    if not staff_id:
        return jsonify({"error": "Validation", "message": "staff_id is required"}), 400
    if len(reason) < 3:
        return jsonify({"error": "Validation", "message": "A reason is required for manual attendance"}), 400

    staff = Staff.query.get_or_404(staff_id)
    if staff.status != "Active":
        return jsonify({"error": "Inactive", "message": "Staff record is not active"}), 403

    now_local = lagos_now()                 # authoritative server time
    now_time = now_local.time().replace(microsecond=0)
    today = _attendance_day(staff, now_local)
    record = Attendance.query.filter_by(staff_id=staff.staff_id, date=today).first()
    me = current_user()

    if not record:
        status = _status_for_checkin(staff, now_time)
        record = Attendance(staff_id=staff.staff_id, date=today, time_in=now_time,
                            status=status, verification_method="Manual")
        db.session.add(record)
        db.session.commit()
        record_audit("MANUAL_CHECK_IN", "attendance",
                     f"{staff.full_name} manual check-in ({status}) by {me.username}; reason: {reason}",
                     user_id=me.user_id)
        return jsonify({"action": "check_in", "staff_name": staff.full_name,
                        "status": status, "time": now_time.strftime("%H:%M"),
                        "message": f"Manual check-in recorded for {staff.full_name}."}), 200

    if record.time_in and not record.time_out:
        record.time_out = now_time
        db.session.commit()
        record_audit("MANUAL_CHECK_OUT", "attendance",
                     f"{staff.full_name} manual check-out by {me.username}; reason: {reason}",
                     user_id=me.user_id)
        return jsonify({"action": "check_out", "staff_name": staff.full_name,
                        "status": record.status, "time": now_time.strftime("%H:%M"),
                        "message": f"Manual check-out recorded for {staff.full_name}."}), 200

    return jsonify({"action": "duplicate", "staff_name": staff.full_name,
                    "message": f"{staff.full_name} already has full attendance today."}), 409


# ----------------------------------------------------------------------------
# LIST attendance records.
#   Admin: all, with filters ?from=&to=&department_id=&status=&staff_id=
#   Staff: forced to their own records only.
# ----------------------------------------------------------------------------
@attendance_bp.get("")
@jwt_required()
@roles_required("admin", "staff")
def list_attendance():
    user = current_user()
    query = Attendance.query

    if user.role == "staff":
        # Staff can ONLY ever see their own rows — ignore any staff_id param.
        query = query.filter_by(staff_id=user.staff_id)
    else:
        # Admin filters
        sid = request.args.get("staff_id")
        if sid:
            query = query.filter(Attendance.staff_id == int(sid))
        dept = request.args.get("department_id")
        if dept:
            query = query.join(Staff).filter(Staff.department_id == int(dept))

    # Shared filters
    frm = request.args.get("from")
    to = request.args.get("to")
    status = request.args.get("status")
    if frm:
        query = query.filter(Attendance.date >= frm)
    if to:
        query = query.filter(Attendance.date <= to)
    if status in ("Present", "Late", "Absent", "Incomplete"):
        query = query.filter(Attendance.status == status)

    rows = query.order_by(Attendance.date.desc(), Attendance.time_in.desc()).limit(500).all()
    with_staff = (user.role == "admin")
    return jsonify({"attendance": [r.to_dict(with_staff=with_staff) for r in rows]}), 200


# ----------------------------------------------------------------------------
# GET a single staff member's records (explicit, ownership-checked).
# ----------------------------------------------------------------------------
@attendance_bp.get("/staff/<int:staff_id>")
@jwt_required()
@roles_required("admin", "staff")
def staff_attendance(staff_id):
    denied = ensure_self_or_admin(staff_id)
    if denied:
        return denied
    rows = (Attendance.query.filter_by(staff_id=staff_id)
            .order_by(Attendance.date.desc()).all())
    return jsonify({"attendance": [r.to_dict() for r in rows]}), 200


# ----------------------------------------------------------------------------
# CALENDAR — day-by-day view for a month, marking working / non-working /
# holiday days and the staff member's status. Used by the attendance calendar
# and reports so non-working days and holidays are shown clearly (never absent).
#   /api/attendance/calendar?month=YYYY-MM&staff_id=123
# ----------------------------------------------------------------------------
@attendance_bp.get("/calendar")
@jwt_required()
@roles_required("admin", "staff")
def calendar():
    import calendar as _cal
    from datetime import date as _date
    from app.utils.calendar_rules import day_kind
    from app.models import Holiday

    user = current_user()
    month = request.args.get("month")  # "YYYY-MM"
    sid = request.args.get("staff_id", type=int)

    # Staff may only view their own calendar.
    if user.role == "staff":
        sid = user.staff_id
    if not sid:
        return jsonify({"error": "Validation", "message": "staff_id is required"}), 400
    denied = ensure_self_or_admin(sid)
    if denied:
        return denied

    staff = Staff.query.get_or_404(sid)
    try:
        year, mon = map(int, (month or "").split("-"))
    except ValueError:
        today = lagos_date()
        year, mon = today.year, today.month

    days_in_month = _cal.monthrange(year, mon)[1]
    records = {a.date: a for a in Attendance.query.filter(
        Attendance.staff_id == sid,
        Attendance.date >= _date(year, mon, 1),
        Attendance.date <= _date(year, mon, days_in_month)).all()}
    holiday_names = {h.date: h.name for h in Holiday.query.all()}

    out = []
    for d in range(1, days_in_month + 1):
        the_date = _date(year, mon, d)
        kind = day_kind(the_date, staff.shift)  # working | non-working | holiday
        rec = records.get(the_date)
        out.append({
            "date": the_date.isoformat(),
            "kind": kind,
            "holiday_name": holiday_names.get(the_date),
            "status": rec.status if rec else (None if kind != "working" else None),
            "time_in": rec.time_in.strftime("%H:%M") if rec and rec.time_in else None,
            "time_out": rec.time_out.strftime("%H:%M") if rec and rec.time_out else None,
        })

    return jsonify({"month": f"{year:04d}-{mon:02d}", "staff_id": sid, "days": out}), 200
