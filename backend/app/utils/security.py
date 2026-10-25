# ============================================================================
# FILE: app/utils/security.py
# PURPOSE: Role-based access control (RBAC) + ownership enforcement.
# ----------------------------------------------------------------------------
# KEY IDEA (defence against "change the ID in the URL" attacks):
#   - @admin_required         -> only admins may call the route.
#   - @roles_required("admin","staff") -> any listed role may call.
#   - current_user()          -> the User row for the caller.
#   - ensure_self_or_admin(staff_id) -> raise 403 unless the caller is an admin
#                                        OR the resource belongs to them.
# The JWT stores the user_id as identity and {role, staff_id} as extra claims.
# ============================================================================
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from app.models import User


def current_user() -> User | None:
    """Return the User row for the JWT identity (or None)."""
    ident = get_jwt_identity()
    if ident is None:
        return None
    return User.query.get(int(ident))


def _claims() -> dict:
    """Return the custom JWT claims dict ({'role':..., 'staff_id':...})."""
    return get_jwt() or {}


def roles_required(*allowed_roles):
    """
    Decorator: require a valid JWT whose role is in `allowed_roles`.
    Example: @roles_required("admin")  or  @roles_required("admin", "staff")
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = _claims()
            role = claims.get("role")
            if role not in allowed_roles:
                return jsonify({"error": "Forbidden",
                                "message": f"Requires role: {', '.join(allowed_roles)}"}), 403
            # Block disabled accounts even if their token is still valid.
            user = current_user()
            if not user or not user.is_active:
                return jsonify({"error": "Forbidden", "message": "Account is disabled"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def admin_required(fn):
    """Shortcut for @roles_required('admin')."""
    return roles_required("admin")(fn)


def ensure_self_or_admin(target_staff_id: int):
    """
    OWNERSHIP CHECK. Call inside a route after reading a staff_id from the URL.
    - Admins: always allowed.
    - Staff:  allowed ONLY if target_staff_id == their own staff_id.
    Returns None if allowed, or a (response, status) tuple to return on denial.
    """
    claims = _claims()
    if claims.get("role") == "admin":
        return None
    own = claims.get("staff_id")
    if own is not None and int(own) == int(target_staff_id):
        return None
    return jsonify({"error": "Forbidden",
                    "message": "You can only access your own data"}), 403
