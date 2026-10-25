# ============================================================================
# BLUEPRINT: auth  (prefix: /api/auth)
# Endpoints:
#   POST /login            -> username+password -> access & refresh tokens
#   POST /refresh          -> refresh token -> new access token
#   POST /logout           -> revoke current token (JWT blocklist)
#   GET  /me               -> current user profile
#   POST /change-password  -> logged-in user changes own password
#   POST /forgot-password  -> issue a reset token (demo returns it in response)
#   POST /reset-password   -> set a new password using the reset token
#
# SECURITY: rate limiting on /login, bcrypt passwords, account lockout after
# repeated failures, audit logging of login / failed login / logout.
# ============================================================================
import hashlib
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required,
    get_jwt_identity, get_jwt,
)

from app.extensions import db, limiter, jwt
from app.models import User
from app.utils.audit import record_audit
from app.utils.security import current_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# ----------------------------------------------------------------------------
# JWT token blocklist (for logout). In-memory set is fine for a single process;
# use Redis in a multi-process production deployment.
# ----------------------------------------------------------------------------
_revoked_tokens: set[str] = set()


@jwt.token_in_blocklist_loader
def _is_revoked(_jwt_header, jwt_payload) -> bool:
    return jwt_payload["jti"] in _revoked_tokens


def _tokens_for(user: User) -> dict:
    """Create access + refresh tokens carrying role, staff_id & session_epoch."""
    # session_epoch is bumped whenever the admin resets this user's password, so
    # any token issued before the reset becomes invalid (forced logout).
    extra = {"role": user.role, "staff_id": user.staff_id,
             "epoch": user.session_epoch or 0,
             "must_change_password": user.must_change_password}
    identity = str(user.user_id)
    return {
        "access_token": create_access_token(identity=identity, additional_claims=extra),
        "refresh_token": create_refresh_token(identity=identity, additional_claims=extra),
    }


# ----------------------------------------------------------------------------
# LOGIN
# ----------------------------------------------------------------------------
@auth_bp.post("/login")
@limiter.limit(lambda: current_app.config["RATELIMIT_LOGIN"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Validation", "message": "Username and password are required"}), 400

    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()

    # Generic failure message so we never reveal whether the username exists.
    invalid = jsonify({"error": "Unauthorized", "message": "Invalid username or password"}), 401

    if not user:
        record_audit("LOGIN_FAILED", "users", f"Unknown username '{username}'", user_id=None)
        return invalid

    # Account lockout check
    if user.is_locked():
        record_audit("LOGIN_LOCKED", "users", f"Locked account '{username}'", user_id=user.user_id)
        mins = int((user.locked_until - datetime.utcnow()).total_seconds() // 60) + 1
        return jsonify({"error": "Locked",
                        "message": f"Account locked. Try again in {mins} minute(s)."}), 423

    if not user.is_active:
        return jsonify({"error": "Forbidden", "message": "Account is disabled"}), 403

    # Password check
    if not user.check_password(password):
        user.failed_attempts += 1
        max_attempts = current_app.config["LOGIN_MAX_ATTEMPTS"]
        if user.failed_attempts >= max_attempts:
            user.locked_until = datetime.utcnow() + timedelta(
                minutes=current_app.config["LOGIN_LOCKOUT_MINUTES"]
            )
            user.failed_attempts = 0
            record_audit("LOGIN_LOCKED", "users", f"Too many failures for '{username}'", user_id=user.user_id, commit=False)
        else:
            record_audit("LOGIN_FAILED", "users", f"Wrong password for '{username}'", user_id=user.user_id, commit=False)
        db.session.commit()
        return invalid

    # If the user is on a temp password, make sure it hasn't expired (24h).
    if user.must_change_password and not user.temp_password_valid():
        record_audit("LOGIN_TEMP_EXPIRED", "users",
                     f"Expired temp password for '{username}'", user_id=user.user_id)
        return jsonify({"error": "Expired",
                        "message": "Your temporary password has expired. "
                                   "Please request another reset."}), 403

    # Success: reset counters, stamp last_login
    user.failed_attempts = 0
    user.locked_until = None
    user.last_login = datetime.utcnow()
    db.session.commit()

    tokens = _tokens_for(user)
    record_audit("LOGIN", "users", f"{username} logged in", user_id=user.user_id)
    # Tell the frontend to force a password change before anything else.
    return jsonify({"user": user.to_dict(),
                    "must_change_password": user.must_change_password,
                    **tokens}), 200


# ----------------------------------------------------------------------------
# REFRESH  (send the refresh token as Bearer)
# ----------------------------------------------------------------------------
@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user = current_user()
    if not user or not user.is_active:
        return jsonify({"error": "Forbidden", "message": "Account is disabled"}), 403
    extra = {"role": user.role, "staff_id": user.staff_id}
    access = create_access_token(identity=str(user.user_id), additional_claims=extra)
    return jsonify({"access_token": access}), 200


# ----------------------------------------------------------------------------
# LOGOUT  (revoke the presented access token)
# ----------------------------------------------------------------------------
@auth_bp.post("/logout")
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    _revoked_tokens.add(jti)
    record_audit("LOGOUT", "users", "User logged out")
    return jsonify({"message": "Logged out"}), 200


# ----------------------------------------------------------------------------
# ME  (who am I?)
# ----------------------------------------------------------------------------
@auth_bp.get("/me")
@jwt_required()
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "NotFound", "message": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


# ----------------------------------------------------------------------------
# CHANGE PASSWORD (logged in)
# ----------------------------------------------------------------------------
@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new = data.get("new_password") or ""

    # Enforce strong password rules (same as frontend).
    from app.utils.password_gen import password_issues
    issues = password_issues(new)
    if issues:
        return jsonify({"error": "Validation",
                        "message": "Password must include: " + ", ".join(issues)}), 400

    user = current_user()
    if not user or not user.check_password(current):
        return jsonify({"error": "Unauthorized", "message": "Current password is incorrect"}), 401
    # Don't allow reusing the temp/current password.
    if current == new:
        return jsonify({"error": "Validation", "message": "New password must differ from the current one"}), 400

    user.set_password(new)
    # Clear the forced-change flag + temp expiry now that they've set their own.
    user.must_change_password = False
    user.temp_password_expires = None
    db.session.commit()
    record_audit("CHANGE_PASSWORD", "users", f"{user.username} changed password", user_id=user.user_id)
    return jsonify({"message": "Password changed successfully"}), 200


# ----------------------------------------------------------------------------
# FORGOT PASSWORD  -> issue a one-time reset token
# NOTE: For demo we return the token in the response. In production, EMAIL it
#       and return only a generic message (see TODO below).
# ----------------------------------------------------------------------------
@auth_bp.post("/forgot-password")
@limiter.limit("5 per minute")
def forgot_password():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()

    # Always respond the same way so attackers can't enumerate usernames.
    generic = {"message": "If that account exists, a reset token has been issued."}

    if not user:
        return jsonify(generic), 200

    raw_token = secrets.token_urlsafe(32)
    user.reset_token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    user.reset_token_expires = datetime.utcnow() + timedelta(
        minutes=current_app.config["RESET_TOKEN_MINUTES"]
    )
    db.session.commit()
    record_audit("FORGOT_PASSWORD", "users", f"Reset requested for '{username}'", user_id=user.user_id)

    # TODO(PROD): send `raw_token` by email instead of returning it.
    return jsonify({**generic, "reset_token": raw_token,
                    "note": "DEMO ONLY: in production this is emailed, not returned."}), 200


# ----------------------------------------------------------------------------
# RESET PASSWORD  -> consume the token and set a new password
# ----------------------------------------------------------------------------
@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("reset_token") or ""
    new = data.get("new_password") or ""

    if len(new) < 6:
        return jsonify({"error": "Validation", "message": "New password must be at least 6 characters"}), 400

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    user = User.query.filter_by(reset_token_hash=token_hash).first()

    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        return jsonify({"error": "Invalid", "message": "Reset token is invalid or expired"}), 400

    user.set_password(new)
    user.reset_token_hash = None
    user.reset_token_expires = None
    user.failed_attempts = 0
    user.locked_until = None
    db.session.commit()
    record_audit("RESET_PASSWORD", "users", f"{user.username} reset password", user_id=user.user_id)
    return jsonify({"message": "Password has been reset. You can now log in."}), 200
