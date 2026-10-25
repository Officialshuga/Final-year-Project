# ============================================================================
# BLUEPRINT: users  (prefix: /api/users)  — ADMIN ONLY
# List, create, update role, reset password, enable/disable, delete.
# ============================================================================
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import User, Staff
from app.utils.security import admin_required, current_user
from app.utils.audit import record_audit

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.get("")
@jwt_required()
@admin_required
def list_users():
    role = request.args.get("role")
    query = User.query
    if role in ("admin", "staff"):
        query = query.filter_by(role=role)
    rows = query.order_by(User.username).all()
    return jsonify({"users": [u.to_dict() for u in rows]}), 200


@users_bp.post("")
@jwt_required()
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""
    role = data.get("role") or "staff"
    staff_id = data.get("staff_id")

    if len(username) < 3:
        return jsonify({"error": "Validation", "message": "Username min 3 chars"}), 400
    if len(password) < 6:
        return jsonify({"error": "Validation", "message": "Password min 6 chars"}), 400
    if role not in ("admin", "staff"):
        return jsonify({"error": "Validation", "message": "role must be 'admin' or 'staff'"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Conflict", "message": "Username already exists"}), 409

    # Staff-role accounts should link to a staff record.
    if role == "staff":
        if not staff_id or not Staff.query.get(staff_id):
            return jsonify({"error": "Validation", "message": "Valid staff_id required for staff role"}), 400
        if User.query.filter_by(staff_id=staff_id).first():
            return jsonify({"error": "Conflict", "message": "That staff member already has a login"}), 409
    else:
        staff_id = None  # admins are not linked to a staff record

    u = User(username=username, role=role, staff_id=staff_id, is_active=True)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    record_audit("CREATE_USER", "users", f"Created {username} ({role})")
    return jsonify({"user": u.to_dict()}), 201


@users_bp.patch("/<int:user_id>/role")
@jwt_required()
@admin_required
def update_role(user_id):
    u = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in ("admin", "staff"):
        return jsonify({"error": "Validation", "message": "role must be 'admin' or 'staff'"}), 400
    if role == "staff" and not u.staff_id:
        return jsonify({"error": "Validation", "message": "Cannot set role 'staff' on an account not linked to a staff record"}), 400
    u.role = role
    db.session.commit()
    record_audit("UPDATE_USER_ROLE", "users", f"{u.username} -> {role}")
    return jsonify({"user": u.to_dict()}), 200


@users_bp.patch("/<int:user_id>/reset-password")
@jwt_required()
@admin_required
def admin_reset_password(user_id):
    """
    DIRECT admin reset (no request needed). Generates a strong temp password,
    hashes it, forces a change on first login, expires in 24h, and logs out any
    existing sessions. Returns the temp password ONCE for the admin to hand over.
    """
    u = User.query.get_or_404(user_id)
    # Reuse the shared reset logic from the password_requests module.
    from app.password_requests.routes import _apply_reset
    temp = _apply_reset(u)
    db.session.commit()
    record_audit("ADMIN_RESET_PASSWORD", "users", f"Reset password for @{u.username}")
    return jsonify({"message": "Password reset", "username": u.username,
                    "temp_password": temp, "expires_in_hours": 24,
                    "note": "Shown once. Hand it over securely; user must change it on first login."}), 200


@users_bp.patch("/<int:user_id>/status")
@jwt_required()
@admin_required
def set_user_status(user_id):
    u = User.query.get_or_404(user_id)
    me = current_user()
    if me and me.user_id == u.user_id:
        return jsonify({"error": "Forbidden", "message": "You cannot disable your own account"}), 403
    data = request.get_json(silent=True) or {}
    is_active = bool(data.get("is_active", True))
    u.is_active = is_active
    db.session.commit()
    record_audit("SET_USER_STATUS", "users", f"{u.username} active={is_active}")
    return jsonify({"user": u.to_dict()}), 200


@users_bp.delete("/<int:user_id>")
@jwt_required()
@admin_required
def delete_user(user_id):
    u = User.query.get_or_404(user_id)
    me = current_user()
    if me and me.user_id == u.user_id:
        return jsonify({"error": "Forbidden", "message": "You cannot delete your own account"}), 403
    username = u.username
    db.session.delete(u)
    db.session.commit()
    record_audit("DELETE_USER", "users", f"Deleted {username}")
    return jsonify({"message": "User deleted"}), 200
