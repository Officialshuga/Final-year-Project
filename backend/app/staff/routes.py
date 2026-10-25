# ============================================================================
# BLUEPRINT: staff  (prefix: /api/staff)  — ADMIN ONLY
# Features: list (search, filter by department & status, pagination), get,
#           create (also creates a login user), update, deactivate/reactivate,
#           delete.
# ============================================================================
import re
from datetime import datetime
from flask import Blueprint, request, jsonify

from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models import Staff, Department, Shift, User
from app.utils.security import admin_required
from app.utils.audit import record_audit

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _unique_username(base: str) -> str:
    """Make a unique username from a base string (e.g. derived from email)."""
    base = re.sub(r"[^a-z0-9._]", "", base.lower()) or "staff"
    candidate = base
    i = 1
    while User.query.filter_by(username=candidate).first():
        i += 1
        candidate = f"{base}{i}"
    return candidate


# ----------------------------------------------------------------------------
# LIST  (search + filter + pagination)
#   /api/staff?search=joy&department_id=3&status=Active&page=1&per_page=10
# ----------------------------------------------------------------------------
@staff_bp.get("")
@jwt_required()
@admin_required
def list_staff():
    search = (request.args.get("search") or "").strip()
    dept = request.args.get("department_id")
    status = request.args.get("status")
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 10)), 1), 100)

    query = Staff.query
    if search:
        like = f"%{search}%"
        # SQLAlchemy parameterises these — safe from SQL injection.
        query = query.filter(
            db.or_(
                Staff.full_name.ilike(like),
                Staff.staff_number.ilike(like),
                Staff.email.ilike(like),
            )
        )
    if dept:
        query = query.filter(Staff.department_id == int(dept))
    if status in ("Active", "Inactive"):
        query = query.filter(Staff.status == status)

    total = query.count()
    rows = (query.order_by(Staff.full_name)
            .offset((page - 1) * per_page).limit(per_page).all())

    return jsonify({
        "staff": [s.to_dict() for s in rows],
        "pagination": {
            "page": page, "per_page": per_page, "total": total,
            "pages": (total + per_page - 1) // per_page,
        },
    }), 200


# ----------------------------------------------------------------------------
# GET one
# ----------------------------------------------------------------------------
@staff_bp.get("/<int:staff_id>")
@jwt_required()
@admin_required
def get_staff(staff_id):
    s = Staff.query.get_or_404(staff_id)
    return jsonify({"staff": s.to_dict()}), 200


# ----------------------------------------------------------------------------
# CREATE  (also creates a linked login user with role 'staff')
# ----------------------------------------------------------------------------
@staff_bp.post("")
@jwt_required()
@admin_required
def create_staff():
    data = request.get_json(silent=True) or {}

    # --- Validation ---
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    staff_number = (data.get("staff_number") or "").strip()
    errors = {}
    if len(full_name) < 3:
        errors["full_name"] = "Full name is required (min 3 chars)."
    if not EMAIL_RE.match(email):
        errors["email"] = "A valid email is required."
    if not staff_number:
        errors["staff_number"] = "Staff number is required."
    if errors:
        return jsonify({"error": "Validation", "fields": errors}), 400

    # --- Uniqueness checks ---
    if Staff.query.filter_by(staff_number=staff_number).first():
        return jsonify({"error": "Conflict", "message": "Staff number already exists"}), 409
    if Staff.query.filter(db.func.lower(Staff.email) == email).first():
        return jsonify({"error": "Conflict", "message": "Email already exists"}), 409

    # --- FK sanity (optional fields) ---
    dept_id = data.get("department_id")
    shift_id = data.get("shift_id")
    if dept_id and not Department.query.get(dept_id):
        return jsonify({"error": "Validation", "message": "Unknown department_id"}), 400
    if shift_id and not Shift.query.get(shift_id):
        return jsonify({"error": "Validation", "message": "Unknown shift_id"}), 400

    s = Staff(
        staff_number=staff_number,
        full_name=full_name,
        email=email,
        phone=(data.get("phone") or "").strip() or None,
        gender=(data.get("gender") or "").strip() or None,
        department_id=dept_id,
        shift_id=shift_id,
        designation=(data.get("designation") or "").strip() or None,
        status="Active",
        date_registered=datetime.utcnow(),
    )
    db.session.add(s)
    db.session.flush()  # get s.staff_id before creating the user

    # --- Auto-create login user (role 'staff') ---
    username = (data.get("username") or "").strip().lower() or _unique_username(email.split("@")[0])
    if User.query.filter_by(username=username).first():
        username = _unique_username(username)
    temp_password = (data.get("password") or "staff123")

    user = User(username=username, role="staff", staff_id=s.staff_id, is_active=True)
    user.set_password(temp_password)
    db.session.add(user)

    db.session.commit()
    record_audit("CREATE_STAFF", "staff", f"Added {full_name} ({staff_number}); login '{username}'")

    result = s.to_dict()
    result["login"] = {"username": username, "temp_password": temp_password,
                       "note": "Share securely; ask the staff member to change it."}
    return jsonify({"staff": result}), 201


# ----------------------------------------------------------------------------
# UPDATE
# ----------------------------------------------------------------------------
@staff_bp.put("/<int:staff_id>")
@jwt_required()
@admin_required
def update_staff(staff_id):
    s = Staff.query.get_or_404(staff_id)
    data = request.get_json(silent=True) or {}

    if "full_name" in data:
        s.full_name = (data["full_name"] or "").strip() or s.full_name
    if "email" in data:
        email = (data["email"] or "").strip().lower()
        if not EMAIL_RE.match(email):
            return jsonify({"error": "Validation", "message": "Invalid email"}), 400
        clash = Staff.query.filter(db.func.lower(Staff.email) == email, Staff.staff_id != staff_id).first()
        if clash:
            return jsonify({"error": "Conflict", "message": "Email already in use"}), 409
        s.email = email
    if "staff_number" in data:
        num = (data["staff_number"] or "").strip()
        clash = Staff.query.filter(Staff.staff_number == num, Staff.staff_id != staff_id).first()
        if clash:
            return jsonify({"error": "Conflict", "message": "Staff number already in use"}), 409
        s.staff_number = num or s.staff_number
    for field in ("phone", "gender", "designation"):
        if field in data:
            setattr(s, field, (data[field] or "").strip() or None)
    if "department_id" in data:
        if data["department_id"] and not Department.query.get(data["department_id"]):
            return jsonify({"error": "Validation", "message": "Unknown department_id"}), 400
        s.department_id = data["department_id"]
    if "shift_id" in data:
        if data["shift_id"] and not Shift.query.get(data["shift_id"]):
            return jsonify({"error": "Validation", "message": "Unknown shift_id"}), 400
        s.shift_id = data["shift_id"]

    db.session.commit()
    record_audit("UPDATE_STAFF", "staff", f"Updated {s.full_name} ({s.staff_number})")
    return jsonify({"staff": s.to_dict()}), 200


# ----------------------------------------------------------------------------
# DEACTIVATE / REACTIVATE  (also toggles their login account)
# ----------------------------------------------------------------------------
@staff_bp.patch("/<int:staff_id>/status")
@jwt_required()
@admin_required
def set_status(staff_id):
    s = Staff.query.get_or_404(staff_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in ("Active", "Inactive"):
        return jsonify({"error": "Validation", "message": "status must be 'Active' or 'Inactive'"}), 400
    s.status = new_status
    if s.user:
        s.user.is_active = (new_status == "Active")
    db.session.commit()
    record_audit("SET_STAFF_STATUS", "staff", f"{s.full_name} -> {new_status}")
    return jsonify({"staff": s.to_dict()}), 200


# ----------------------------------------------------------------------------
# DELETE  (cascades to biometrics, attendance and login)
# ----------------------------------------------------------------------------
@staff_bp.delete("/<int:staff_id>")
@jwt_required()
@admin_required
def delete_staff(staff_id):
    s = Staff.query.get_or_404(staff_id)
    name = f"{s.full_name} ({s.staff_number})"
    db.session.delete(s)
    db.session.commit()
    record_audit("DELETE_STAFF", "staff", f"Deleted {name}")
    return jsonify({"message": "Staff deleted"}), 200
