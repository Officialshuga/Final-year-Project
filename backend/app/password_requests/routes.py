# ============================================================================
# BLUEPRINT: password_requests  (prefix: /api/password-requests)
# ----------------------------------------------------------------------------
# PUBLIC (no login):
#   POST /                      submit a reset request by staff ID (+ message)
#
# ADMIN ONLY:
#   GET   /                     list requests (filter by status)
#   PATCH /:id/reset            reset the account -> returns a temp password ONCE
#   PATCH /:id/reject           reject the request
#
# SECURITY:
#   - Submit is RATE-LIMITED (5/hour/IP) and NEVER reveals whether the ID exists.
#   - Duplicate PENDING requests for the same staff are ignored silently.
#   - Reset generates a strong temp password, hashes it (bcrypt), sets
#     must_change_password + 24h expiry, bumps session_epoch (logs out old
#     sessions), and records who handled it + when.
#   - Every submit/reset/reject is written to the audit log with IP + time.
# ============================================================================
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

from app.extensions import db, limiter
from app.models import PasswordResetRequest, Staff, User
from app.utils.security import admin_required, current_user
from app.utils.audit import record_audit
from app.utils.password_gen import generate_temp_password

password_requests_bp = Blueprint("password_requests", __name__, url_prefix="/api/password-requests")

GENERIC_MESSAGE = "If this account exists, your request has been sent to the administrator."


# ----------------------------------------------------------------------------
# PUBLIC: submit a request (no auth). Always returns the SAME message.
# ----------------------------------------------------------------------------
@password_requests_bp.post("")
@limiter.limit("5 per hour")  # rate limit per client IP
def submit_request():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("staff_id") or "").strip()
    message = (data.get("message") or "").strip()[:255]
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)

    # Minimal validation — but we STILL respond generically on any issue so the
    # response shape/timing can't be used to probe for valid IDs.
    if identifier:
        # Try to resolve a real staff member (by staff_number).
        staff = Staff.query.filter_by(staff_number=identifier).first()

        # Ignore duplicate pending requests for the same staff / identifier.
        existing = (PasswordResetRequest.query
                    .filter_by(status="pending")
                    .filter((PasswordResetRequest.staff_id == (staff.staff_id if staff else None)) |
                            (PasswordResetRequest.submitted_identifier == identifier))
                    .first())

        if not existing:
            req = PasswordResetRequest(
                staff_id=staff.staff_id if staff else None,
                submitted_identifier=identifier,
                message=message or None,
                status="pending",
                ip_address=ip,
            )
            db.session.add(req)
            db.session.commit()
            # Audit WITHOUT revealing validity in the public response.
            record_audit("PASSWORD_REQUEST", "password_reset_requests",
                         f"Reset requested for '{identifier}' "
                         f"({'matched' if staff else 'no match'})",
                         user_id=None)

    # ALWAYS the same response (prevents staff-ID enumeration).
    return jsonify({"message": GENERIC_MESSAGE}), 202


# ----------------------------------------------------------------------------
# ADMIN: list requests
# ----------------------------------------------------------------------------
@password_requests_bp.get("")
@jwt_required()
@admin_required
def list_requests():
    status = request.args.get("status")
    query = PasswordResetRequest.query
    if status in ("pending", "completed", "rejected"):
        query = query.filter_by(status=status)
    rows = query.order_by(PasswordResetRequest.requested_at.desc()).all()
    pending = PasswordResetRequest.query.filter_by(status="pending").count()
    return jsonify({"requests": [r.to_dict() for r in rows], "pending_count": pending}), 200


# ----------------------------------------------------------------------------
# ADMIN: reset -> generate temp password (returned ONCE), mark completed
# ----------------------------------------------------------------------------
@password_requests_bp.patch("/<int:req_id>/reset")
@jwt_required()
@admin_required
def reset_from_request(req_id):
    req = PasswordResetRequest.query.get_or_404(req_id)
    if req.status != "pending":
        return jsonify({"error": "Conflict", "message": "Request already handled"}), 409
    if not req.staff_id:
        # Unknown staff — nothing to reset. Mark rejected automatically.
        req.status = "rejected"
        req.handled_by = current_user().user_id
        req.handled_at = datetime.utcnow()
        db.session.commit()
        record_audit("PASSWORD_REQUEST_REJECT", "password_reset_requests",
                     f"Auto-rejected unmatched request #{req_id}")
        return jsonify({"error": "NotFound", "message": "No matching staff account for this request"}), 404

    user = User.query.filter_by(staff_id=req.staff_id).first()
    if not user:
        return jsonify({"error": "NotFound", "message": "Staff has no login account"}), 404

    temp = _apply_reset(user)
    req.status = "completed"
    req.handled_by = current_user().user_id
    req.handled_at = datetime.utcnow()
    db.session.commit()

    record_audit("PASSWORD_RESET", "users",
                 f"Reset password for @{user.username} via request #{req_id}")
    # Temp password returned ONCE for the admin to hand over. Never stored plain.
    return jsonify({"message": "Password reset", "username": user.username,
                    "temp_password": temp,
                    "expires_in_hours": 24,
                    "note": "Shown once. Hand it over securely; user must change it on first login."}), 200


# ----------------------------------------------------------------------------
# ADMIN: reject a request
# ----------------------------------------------------------------------------
@password_requests_bp.patch("/<int:req_id>/reject")
@jwt_required()
@admin_required
def reject_request(req_id):
    req = PasswordResetRequest.query.get_or_404(req_id)
    if req.status != "pending":
        return jsonify({"error": "Conflict", "message": "Request already handled"}), 409
    req.status = "rejected"
    req.handled_by = current_user().user_id
    req.handled_at = datetime.utcnow()
    db.session.commit()
    record_audit("PASSWORD_REQUEST_REJECT", "password_reset_requests",
                 f"Rejected request #{req_id}")
    return jsonify({"message": "Request rejected"}), 200


# ----------------------------------------------------------------------------
# Shared reset logic (also used by the direct reset in users routes).
# ----------------------------------------------------------------------------
def _apply_reset(user: User) -> str:
    """Generate temp password, hash it, set flags, invalidate sessions."""
    temp = generate_temp_password(12)
    user.set_password(temp)                 # bcrypt hash (never store plain)
    user.must_change_password = True
    user.temp_password_expires = datetime.utcnow() + timedelta(hours=24)
    user.failed_attempts = 0
    user.locked_until = None
    user.session_epoch = (user.session_epoch or 0) + 1  # logs out old tokens
    return temp
