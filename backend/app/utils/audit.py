# ============================================================================
# FILE: app/utils/audit.py
# PURPOSE: One helper to write an audit log row. Called from routes and from
#          the global after_request middleware.
# ----------------------------------------------------------------------------
# SECURITY: we never log passwords, tokens or raw biometric data here.
# ============================================================================
from flask import request
from app.extensions import db
from app.models import AuditLog


def record_audit(action: str, table_affected: str | None = None,
                 details: str | None = None, user_id: int | None = None,
                 commit: bool = True) -> None:
    """
    Append an audit entry.

    action          : short verb, e.g. "LOGIN", "CREATE_STAFF", "EXPORT"
    table_affected  : which table changed, e.g. "staff" (optional)
    details         : short human-readable note (no secrets)
    user_id         : acting user; if None we try the JWT identity
    """
    if user_id is None:
        # Lazy import to avoid circulars; identity may be absent (failed login).
        try:
            from flask_jwt_extended import get_jwt_identity
            ident = get_jwt_identity()
            user_id = int(ident) if ident is not None else None
        except Exception:
            user_id = None

    ip = request.headers.get("X-Forwarded-For", request.remote_addr) if request else None

    entry = AuditLog(
        user_id=user_id,
        action=action,
        table_affected=table_affected,
        details=details,
        ip_address=ip,
    )
    db.session.add(entry)
    if commit:
        db.session.commit()
