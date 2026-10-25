# ============================================================================
# BLUEPRINT: reports  (prefix: /api/reports)
#   Admin: confidential org-wide reports (daily/weekly/monthly, late, absentees,
#          department summary) + export PDF/Excel.
#   Staff: personal report + export of their own data only.
# ============================================================================
import io
from datetime import date as date_cls, timedelta, datetime
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import Attendance, Staff, Department
from app.utils.security import roles_required, current_user, ensure_self_or_admin
from app.utils.audit import record_audit

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


# ------------------------------- helpers ------------------------------------
def _range_for(period: str):
    """Return (from_date, to_date) for daily/weekly/monthly."""
    today = date_cls.today()
    if period == "daily":
        return today, today
    if period == "weekly":
        return today - timedelta(days=6), today
    if period == "monthly":
        return today.replace(day=1), today
    return today - timedelta(days=6), today


def _summarise(rows):
    present = sum(1 for a in rows if a.status == "Present")
    late = sum(1 for a in rows if a.status == "Late")
    absent = sum(1 for a in rows if a.status == "Absent")
    hours = round(sum(a.hours_worked() for a in rows), 1)
    return {"present": present, "late": late, "absent": absent,
            "total_records": len(rows), "hours_worked": hours}


# ------------------------------- ADMIN reports ------------------------------
@reports_bp.get("/admin")
@jwt_required()
@roles_required("admin")
def admin_report():
    period = request.args.get("period", "weekly")  # daily|weekly|monthly
    frm, to = _range_for(period)

    rows = Attendance.query.filter(Attendance.date >= frm, Attendance.date <= to).all()
    today = date_cls.today()
    todays = [a for a in rows if a.date == today]

    # Late + absentees today
    late_today = [a.to_dict(with_staff=True) for a in todays if a.status == "Late"]
    absent_today = [a.to_dict(with_staff=True) for a in todays if a.status == "Absent"]

    # Department summary over the period
    dept_summary = []
    for dept in Department.query.all():
        ids = [s.staff_id for s in dept.staff]
        drows = [a for a in rows if a.staff_id in ids]
        dept_summary.append({"department": dept.name, **_summarise(drows)})

    return jsonify({
        "period": period, "from": frm.isoformat(), "to": to.isoformat(),
        "summary": _summarise(rows),
        "late_today": late_today,
        "absentees_today": absent_today,
        "department_summary": dept_summary,
    }), 200


# ------------------------------- STAFF personal report ----------------------
@reports_bp.get("/me")
@jwt_required()
@roles_required("admin", "staff")
def my_report():
    user = current_user()
    if not user.staff_id:
        return jsonify({"error": "Validation", "message": "This endpoint is for staff accounts"}), 400
    period = request.args.get("period", "monthly")
    frm, to = _range_for(period)
    rows = (Attendance.query
            .filter(Attendance.staff_id == user.staff_id,
                    Attendance.date >= frm, Attendance.date <= to)
            .order_by(Attendance.date.desc()).all())
    return jsonify({
        "period": period, "from": frm.isoformat(), "to": to.isoformat(),
        "summary": _summarise(rows),
        "records": [a.to_dict() for a in rows],
    }), 200


# ------------------------------- EXPORT (Excel) -----------------------------
@reports_bp.get("/export/excel")
@jwt_required()
@roles_required("admin", "staff")
def export_excel():
    from openpyxl import Workbook

    user = current_user()
    rows = _rows_for_export(user)

    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.append(["Date", "Staff", "Staff Number", "Department", "Time In", "Time Out", "Hours", "Status"])
    for a in rows:
        s = a.staff
        ws.append([
            a.date.isoformat(), s.full_name if s else "", s.staff_number if s else "",
            s.department.name if s and s.department else "",
            a.time_in.strftime("%H:%M") if a.time_in else "",
            a.time_out.strftime("%H:%M") if a.time_out else "",
            a.hours_worked(), a.status,
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    record_audit("EXPORT", "attendance", f"Exported {len(rows)} rows to Excel")
    return send_file(buf, as_attachment=True, download_name="attendance.xlsx",
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ------------------------------- EXPORT (PDF) -------------------------------
@reports_bp.get("/export/pdf")
@jwt_required()
@roles_required("admin", "staff")
def export_pdf():
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    user = current_user()
    rows = _rows_for_export(user)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Attendance Report")
    styles = getSampleStyleSheet()
    elements = [Paragraph("GVU Attendance Report", styles["Title"]),
                Paragraph(f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["Normal"]),
                Spacer(1, 0.5 * cm)]

    data = [["Date", "Staff", "Dept", "In", "Out", "Status"]]
    for a in rows:
        s = a.staff
        data.append([
            a.date.isoformat(), s.full_name if s else "",
            (s.department.name if s and s.department else "")[:12],
            a.time_in.strftime("%H:%M") if a.time_in else "-",
            a.time_out.strftime("%H:%M") if a.time_out else "-",
            a.status,
        ])
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1d4ed8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eff6ff")]),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)
    record_audit("EXPORT", "attendance", f"Exported {len(rows)} rows to PDF")
    return send_file(buf, as_attachment=True, download_name="attendance.pdf",
                     mimetype="application/pdf")


def _rows_for_export(user):
    """Admin exports everything (optionally filtered); staff export only own."""
    query = Attendance.query
    if user.role == "staff":
        query = query.filter_by(staff_id=user.staff_id)
    else:
        sid = request.args.get("staff_id")
        if sid:
            query = query.filter_by(staff_id=int(sid))
    frm = request.args.get("from")
    to = request.args.get("to")
    if frm:
        query = query.filter(Attendance.date >= frm)
    if to:
        query = query.filter(Attendance.date <= to)
    return query.order_by(Attendance.date.desc()).limit(2000).all()
