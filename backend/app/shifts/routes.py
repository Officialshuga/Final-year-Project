# ============================================================================
# BLUEPRINT: shifts  (prefix: /api/shifts)  — ADMIN ONLY
# Full CRUD. Deleting is blocked if staff are still assigned.
# ============================================================================
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import Shift, Staff
from app.utils.security import admin_required
from app.utils.audit import record_audit

shifts_bp = Blueprint("shifts", __name__, url_prefix="/api/shifts")


def _parse_time(value: str):
    """Accept 'HH:MM' and return a datetime.time, or None if invalid."""
    try:
        return datetime.strptime(value, "%H:%M").time()
    except (ValueError, TypeError):
        return None


@shifts_bp.get("")
@jwt_required()
@admin_required
def list_shifts():
    rows = Shift.query.order_by(Shift.start_time).all()
    return jsonify({"shifts": [s.to_dict() for s in rows]}), 200


@shifts_bp.post("")
@jwt_required()
@admin_required
def create_shift():
    data = request.get_json(silent=True) or {}
    name = (data.get("shift_name") or "").strip()
    start = _parse_time(data.get("start_time"))
    end = _parse_time(data.get("end_time"))
    grace = data.get("grace_period_minutes", 0)

    if len(name) < 2:
        return jsonify({"error": "Validation", "message": "Shift name is required"}), 400
    if not start or not end:
        return jsonify({"error": "Validation", "message": "start_time and end_time must be HH:MM"}), 400
    try:
        grace = int(grace)
    except (ValueError, TypeError):
        return jsonify({"error": "Validation", "message": "grace_period_minutes must be a number"}), 400

    s = Shift(shift_name=name, start_time=start, end_time=end, grace_period_minutes=grace)
    db.session.add(s)
    db.session.commit()
    record_audit("CREATE_SHIFT", "shifts", f"Created '{name}'")
    return jsonify({"shift": s.to_dict()}), 201


@shifts_bp.put("/<int:shift_id>")
@jwt_required()
@admin_required
def update_shift(shift_id):
    s = Shift.query.get_or_404(shift_id)
    data = request.get_json(silent=True) or {}
    if "shift_name" in data:
        s.shift_name = (data["shift_name"] or "").strip() or s.shift_name
    if "start_time" in data:
        t = _parse_time(data["start_time"])
        if not t:
            return jsonify({"error": "Validation", "message": "start_time must be HH:MM"}), 400
        s.start_time = t
    if "end_time" in data:
        t = _parse_time(data["end_time"])
        if not t:
            return jsonify({"error": "Validation", "message": "end_time must be HH:MM"}), 400
        s.end_time = t
    if "grace_period_minutes" in data:
        try:
            s.grace_period_minutes = int(data["grace_period_minutes"])
        except (ValueError, TypeError):
            return jsonify({"error": "Validation", "message": "grace_period_minutes must be a number"}), 400
    db.session.commit()
    record_audit("UPDATE_SHIFT", "shifts", f"Updated '{s.shift_name}'")
    return jsonify({"shift": s.to_dict()}), 200


@shifts_bp.delete("/<int:shift_id>")
@jwt_required()
@admin_required
def delete_shift(shift_id):
    s = Shift.query.get_or_404(shift_id)
    assigned = Staff.query.filter_by(shift_id=shift_id).count()
    if assigned > 0:
        return jsonify({"error": "Conflict",
                        "message": f"{assigned} staff still on this shift. Reassign them first."}), 409
    name = s.shift_name
    db.session.delete(s)
    db.session.commit()
    record_audit("DELETE_SHIFT", "shifts", f"Deleted '{name}'")
    return jsonify({"message": "Shift deleted"}), 200
