# ============================================================================
# BLUEPRINT: audit  (prefix: /api/audit)
#   Admin: see ALL logs with filters (?action=&user_id=&from=&to=&search=)
#   Staff: see ONLY their own logs.
# Audit logs are append-only — there are no create/update/delete endpoints.
# ============================================================================
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models import AuditLog
from app.utils.security import roles_required, current_user

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")


@audit_bp.get("")
@jwt_required()
@roles_required("admin", "staff")
def list_logs():
    user = current_user()
    query = AuditLog.query

    if user.role == "staff":
        # Staff see only their own actions.
        query = query.filter_by(user_id=user.user_id)
    else:
        uid = request.args.get("user_id")
        if uid:
            query = query.filter(AuditLog.user_id == int(uid))

    action = request.args.get("action")
    if action:
        query = query.filter(AuditLog.action == action)

    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(AuditLog.details.ilike(f"%{search}%"))

    frm = request.args.get("from")
    to = request.args.get("to")
    if frm:
        query = query.filter(AuditLog.timestamp >= frm)
    if to:
        query = query.filter(AuditLog.timestamp <= to + " 23:59:59")

    rows = query.order_by(AuditLog.timestamp.desc()).limit(500).all()
    return jsonify({"logs": [r.to_dict() for r in rows]}), 200
