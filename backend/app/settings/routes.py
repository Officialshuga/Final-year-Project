# ============================================================================
# BLUEPRINT: settings  (prefix: /api/settings)  — ADMIN ONLY
#   Working days config + Holidays CRUD.
# ----------------------------------------------------------------------------
#   GET   /working-days            -> current working-day weekdays
#   PUT   /working-days            -> { days: [0..6] }  (Mon=0..Sun=6)
#   GET   /holidays                -> list
#   POST  /holidays                -> { date, name }
#   PUT   /holidays/:id            -> { date?, name? }
#   DELETE/holidays/:id
# ============================================================================
from datetime import datetime
from flask import Blueprint, request, jsonify

from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models import Setting, Holiday
from app.utils.security import admin_required
from app.utils.audit import record_audit

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# --------------------------- Working days ----------------------------------
@settings_bp.get("/working-days")
@jwt_required()
@admin_required
def get_working_days():
    days = Setting.working_days()
    return jsonify({"days": days, "names": [WEEKDAY_NAMES[d] for d in days]}), 200


@settings_bp.put("/working-days")
@jwt_required()
@admin_required
def set_working_days():
    data = request.get_json(silent=True) or {}
    days = data.get("days")
    if not isinstance(days, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in days):
        return jsonify({"error": "Validation", "message": "days must be a list of 0..6 (Mon..Sun)"}), 400
    days = sorted(set(days))
    Setting.put("working_days", days)
    db.session.commit()
    record_audit("SET_WORKING_DAYS", "settings", f"Working days = {days}")
    return jsonify({"days": days, "names": [WEEKDAY_NAMES[d] for d in days]}), 200


# ------------------------------ Holidays -----------------------------------
def _parse_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


@settings_bp.get("/holidays")
@jwt_required()
@admin_required
def list_holidays():
    rows = Holiday.query.order_by(Holiday.date).all()
    return jsonify({"holidays": [h.to_dict() for h in rows]}), 200


@settings_bp.post("/holidays")
@jwt_required()
@admin_required
def add_holiday():
    data = request.get_json(silent=True) or {}
    d = _parse_date(data.get("date"))
    name = (data.get("name") or "").strip()
    if not d or len(name) < 2:
        return jsonify({"error": "Validation", "message": "date (YYYY-MM-DD) and name are required"}), 400
    if Holiday.query.filter_by(date=d).first():
        return jsonify({"error": "Conflict", "message": "A holiday already exists on that date"}), 409
    h = Holiday(date=d, name=name)
    db.session.add(h)
    db.session.commit()
    record_audit("ADD_HOLIDAY", "holidays", f"{name} on {d.isoformat()}")
    return jsonify({"holiday": h.to_dict()}), 201


@settings_bp.put("/holidays/<int:holiday_id>")
@jwt_required()
@admin_required
def update_holiday(holiday_id):
    h = Holiday.query.get_or_404(holiday_id)
    data = request.get_json(silent=True) or {}
    if "date" in data:
        d = _parse_date(data["date"])
        if not d:
            return jsonify({"error": "Validation", "message": "date must be YYYY-MM-DD"}), 400
        h.date = d
    if "name" in data:
        h.name = (data["name"] or "").strip() or h.name
    db.session.commit()
    record_audit("UPDATE_HOLIDAY", "holidays", f"Updated holiday #{holiday_id}")
    return jsonify({"holiday": h.to_dict()}), 200


@settings_bp.delete("/holidays/<int:holiday_id>")
@jwt_required()
@admin_required
def delete_holiday(holiday_id):
    h = Holiday.query.get_or_404(holiday_id)
    name = h.name
    db.session.delete(h)
    db.session.commit()
    record_audit("DELETE_HOLIDAY", "holidays", f"Deleted '{name}'")
    return jsonify({"message": "Holiday deleted"}), 200
