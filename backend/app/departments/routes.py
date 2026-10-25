# ============================================================================
# BLUEPRINT: departments  (prefix: /api/departments)  — ADMIN ONLY
# Full CRUD. Deleting is blocked if staff are still assigned.
# ============================================================================
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import Department, Staff
from app.utils.security import admin_required
from app.utils.audit import record_audit

departments_bp = Blueprint("departments", __name__, url_prefix="/api/departments")


@departments_bp.get("")
@jwt_required()
@admin_required
def list_departments():
    rows = Department.query.order_by(Department.name).all()
    return jsonify({"departments": [d.to_dict() for d in rows]}), 200


@departments_bp.get("/<int:dept_id>")
@jwt_required()
@admin_required
def get_department(dept_id):
    d = Department.query.get_or_404(dept_id)
    return jsonify({"department": d.to_dict()}), 200


@departments_bp.post("")
@jwt_required()
@admin_required
def create_department():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if len(name) < 2:
        return jsonify({"error": "Validation", "message": "Name is required (min 2 chars)"}), 400
    if Department.query.filter(db.func.lower(Department.name) == name.lower()).first():
        return jsonify({"error": "Conflict", "message": "A department with that name exists"}), 409

    d = Department(name=name, description=(data.get("description") or "").strip() or None)
    db.session.add(d)
    db.session.commit()
    record_audit("CREATE_DEPARTMENT", "departments", f"Created '{name}'")
    return jsonify({"department": d.to_dict()}), 201


@departments_bp.put("/<int:dept_id>")
@jwt_required()
@admin_required
def update_department(dept_id):
    d = Department.query.get_or_404(dept_id)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data["name"] or "").strip()
        if len(name) < 2:
            return jsonify({"error": "Validation", "message": "Name is required (min 2 chars)"}), 400
        clash = Department.query.filter(
            db.func.lower(Department.name) == name.lower(), Department.department_id != dept_id
        ).first()
        if clash:
            return jsonify({"error": "Conflict", "message": "Another department has that name"}), 409
        d.name = name
    if "description" in data:
        d.description = (data["description"] or "").strip() or None
    db.session.commit()
    record_audit("UPDATE_DEPARTMENT", "departments", f"Updated '{d.name}'")
    return jsonify({"department": d.to_dict()}), 200


@departments_bp.delete("/<int:dept_id>")
@jwt_required()
@admin_required
def delete_department(dept_id):
    d = Department.query.get_or_404(dept_id)
    assigned = Staff.query.filter_by(department_id=dept_id).count()
    if assigned > 0:
        return jsonify({"error": "Conflict",
                        "message": f"{assigned} staff still assigned. Reassign them first."}), 409
    name = d.name
    db.session.delete(d)
    db.session.commit()
    record_audit("DELETE_DEPARTMENT", "departments", f"Deleted '{name}'")
    return jsonify({"message": "Department deleted"}), 200
