# ============================================================================
# BLUEPRINT: dashboard  (prefix: /api/dashboard)
#   GET /admin  -> org-wide counts, weekly trend, dept breakdown, recent activity
#   GET /me     -> the logged-in staff member's own stats
# ============================================================================
from datetime import date as date_cls, timedelta
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import Staff, Attendance, Department, AuditLog
from app.utils.security import admin_required, roles_required, current_user

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _last_7_days():
    today = date_cls.today()
    return [(today - timedelta(days=i)) for i in range(6, -1, -1)]


# ----------------------------------------------------------------------------
# ADMIN dashboard
# ----------------------------------------------------------------------------
@dashboard_bp.get("/admin")
@jwt_required()
@admin_required
def admin_dashboard():
    today = date_cls.today()

    total_staff = Staff.query.filter_by(status="Active").count()
    todays = Attendance.query.filter_by(date=today).all()
    present = sum(1 for a in todays if a.status == "Present")
    late = sum(1 for a in todays if a.status == "Late")
    # Absent = active staff with no attendance record today.
    marked_ids = {a.staff_id for a in todays}
    absent = Staff.query.filter(Staff.status == "Active",
                                ~Staff.staff_id.in_(marked_ids)).count() if marked_ids else \
             (total_staff - present - late)

    # Weekly trend
    weekly = []
    for d in _last_7_days():
        rows = Attendance.query.filter_by(date=d).all()
        weekly.append({
            "date": d.isoformat(),
            "label": d.strftime("%a"),
            "present": sum(1 for a in rows if a.status == "Present"),
            "late": sum(1 for a in rows if a.status == "Late"),
            "absent": sum(1 for a in rows if a.status == "Absent"),
        })

    # Department breakdown (present today per department)
    dept_breakdown = []
    for dept in Department.query.all():
        ids = [s.staff_id for s in dept.staff if s.status == "Active"]
        present_count = sum(1 for a in todays if a.staff_id in ids and a.status != "Absent")
        dept_breakdown.append({
            "code": dept.name[:3].upper(), "name": dept.name,
            "total": len(ids), "present": present_count,
            "rate": round(present_count / len(ids) * 100) if ids else 0,
        })

    recent = (AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(8).all())

    return jsonify({
        "cards": {"total_staff": total_staff, "present": present, "late": late, "absent": max(absent, 0)},
        "weekly_trend": weekly,
        "department_breakdown": dept_breakdown,
        "recent_activity": [r.to_dict() for r in recent],
    }), 200


# ----------------------------------------------------------------------------
# STAFF personal dashboard
# ----------------------------------------------------------------------------
@dashboard_bp.get("/me")
@jwt_required()
@roles_required("admin", "staff")
def my_dashboard():
    user = current_user()
    if user.role == "admin" or not user.staff_id:
        return jsonify({"error": "Validation", "message": "This endpoint is for staff accounts"}), 400

    staff = Staff.query.get(user.staff_id)
    today = date_cls.today()
    my_rows = Attendance.query.filter_by(staff_id=staff.staff_id).all()
    today_row = next((a for a in my_rows if a.date == today), None)

    present = sum(1 for a in my_rows if a.status == "Present")
    late = sum(1 for a in my_rows if a.status == "Late")
    absent = sum(1 for a in my_rows if a.status == "Absent")
    total = len(my_rows) or 1
    rate = round((present + late) / total * 100)

    weekly = []
    for d in _last_7_days():
        row = next((a for a in my_rows if a.date == d), None)
        val = 1 if row and row.status == "Present" else 0.5 if row and row.status == "Late" else 0
        weekly.append({"date": d.isoformat(), "label": d.strftime("%a"), "value": val})

    return jsonify({
        "staff": staff.to_dict(),
        "today": today_row.to_dict() if today_row else None,
        "cards": {"days_present": present, "times_late": late, "absences": absent,
                  "attendance_rate": rate},
        "weekly_trend": weekly,
        "recent": [a.to_dict() for a in sorted(my_rows, key=lambda x: x.date, reverse=True)[:6]],
    }), 200
