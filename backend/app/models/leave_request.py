# ============================================================================
# MODEL: leave_requests
# Columns: id, staff_id (FK), leave_type, start_date, end_date, reason,
#          status (pending/approved/rejected), created_at
# Used so a staff member on APPROVED leave is not marked absent.
# ============================================================================
from datetime import datetime
from app.extensions import db


class LeaveRequest(db.Model):
    __tablename__ = "leave_requests"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    staff_id = db.Column(
        db.Integer, db.ForeignKey("staff.staff_id", ondelete="CASCADE"), nullable=False, index=True
    )
    leave_type = db.Column(db.String(40), nullable=False, default="Annual")
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending/approved/rejected
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    staff = db.relationship("Staff")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "staff_name": self.staff.full_name if self.staff else None,
            "leave_type": self.leave_type,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "reason": self.reason,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }

    @staticmethod
    def on_approved_leave(staff_id: int, d) -> bool:
        """True if the staff member has an APPROVED leave covering date d."""
        return LeaveRequest.query.filter(
            LeaveRequest.staff_id == staff_id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= d,
            LeaveRequest.end_date >= d,
        ).first() is not None
