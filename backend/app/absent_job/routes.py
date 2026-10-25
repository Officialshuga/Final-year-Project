# ============================================================================
# BLUEPRINT: absent_job  (prefix: /api/absent-job)  — ADMIN ONLY
#   POST /run           -> run the absent job for a chosen date (manual/testing)
#                          Body: { "date": "YYYY-MM-DD" }  (defaults to yesterday)
# ============================================================================
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.utils.security import admin_required, current_user
from app.utils.clock import lagos_date
from .job import mark_absentees_for_date

absent_job_bp = Blueprint("absent_job", __name__, url_prefix="/api/absent-job")


@absent_job_bp.post("/run")
@jwt_required()
@admin_required
def run_job():
    data = request.get_json(silent=True) or {}
    date_str = data.get("date")
    if date_str:
        try:
            target = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Validation", "message": "date must be YYYY-MM-DD"}), 400
    else:
        # Default: yesterday (the last completed working day).
        target = lagos_date() - timedelta(days=1)

    me = current_user()
    summary = mark_absentees_for_date(target, actor_user_id=me.user_id if me else None)
    return jsonify({"message": "Absent job completed", "summary": summary}), 200
