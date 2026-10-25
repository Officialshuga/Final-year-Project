# ============================================================================
# MODEL: password_reset_requests
# Columns: id, staff_id (FK), message, status, requested_at, handled_by, handled_at
# ----------------------------------------------------------------------------
# Staff submit these from the login "Forgot password?" link (no auth required).
# Admins review them on the Password Requests page and Reset or Reject.
#
# IMPORTANT: staff_id is NULLABLE on purpose. When someone submits an unknown
# staff number we STILL insert a row (so timing/behaviour is identical and we
# never reveal whether the ID exists), but with staff_id = NULL and a copy of
# the raw text they typed in `submitted_identifier`.
# ============================================================================
from datetime import datetime
from app.extensions import db


class PasswordResetRequest(db.Model):
    __tablename__ = "password_reset_requests"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # Linked staff (if the submitted ID matched a real staff member).
    staff_id = db.Column(
        db.Integer, db.ForeignKey("staff.staff_id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Exactly what the user typed (for the admin to see, even if unmatched).
    submitted_identifier = db.Column(db.String(80), nullable=False)
    message = db.Column(db.String(255), nullable=True)

    status = db.Column(db.String(20), nullable=False, default="pending")  # pending|completed|rejected
    requested_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    ip_address = db.Column(db.String(45), nullable=True)

    # Who actioned it and when (NULL until handled).
    handled_by = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    handled_at = db.Column(db.DateTime, nullable=True)

    staff = db.relationship("Staff")
    handler = db.relationship("User")

    def to_dict(self) -> dict:
        s = self.staff
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "staff_number": s.staff_number if s else self.submitted_identifier,
            "full_name": s.full_name if s else "Unknown",
            "department": (s.department.name if s and s.department else "—"),
            "message": self.message or "",
            "status": self.status,
            "requested_at": self.requested_at.isoformat(),
            "handled_by": self.handler.username if self.handler else None,
            "handled_at": self.handled_at.isoformat() if self.handled_at else None,
        }
