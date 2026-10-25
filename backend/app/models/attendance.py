# ============================================================================
# MODEL: attendance
# Columns: attendance_id, staff_id (FK), date, time_in, time_out,
#          status (Present/Late/Absent), verification_method
# ============================================================================
from app.extensions import db


class Attendance(db.Model):
    __tablename__ = "attendance"
    __table_args__ = (
        # Only ONE attendance row per staff member per day (prevents duplicates).
        db.UniqueConstraint("staff_id", "date", name="uq_staff_date"),
    )

    attendance_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    staff_id = db.Column(
        db.Integer, db.ForeignKey("staff.staff_id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = db.Column(db.Date, nullable=False, index=True)
    time_in = db.Column(db.Time, nullable=True)
    time_out = db.Column(db.Time, nullable=True)
    # Present / Late / Absent / Incomplete (clocked in but never out)
    status = db.Column(db.String(20), nullable=False, default="Present")
    verification_method = db.Column(db.String(30), nullable=False, default="Fingerprint")

    staff = db.relationship("Staff", back_populates="attendance")

    def hours_worked(self):
        """Decimal hours between time_in and time_out (0 if incomplete)."""
        if not self.time_in or not self.time_out:
            return 0.0
        start = self.time_in.hour * 60 + self.time_in.minute
        end = self.time_out.hour * 60 + self.time_out.minute
        mins = end - start
        if mins < 0:
            mins += 24 * 60  # crossed midnight (night shift)
        return round(mins / 60, 1)

    def to_dict(self, with_staff: bool = False) -> dict:
        data = {
            "attendance_id": self.attendance_id,
            "staff_id": self.staff_id,
            "date": self.date.isoformat(),
            "time_in": self.time_in.strftime("%H:%M") if self.time_in else None,
            "time_out": self.time_out.strftime("%H:%M") if self.time_out else None,
            "status": self.status,
            "verification_method": self.verification_method,
            "hours_worked": self.hours_worked(),
        }
        if with_staff and self.staff:
            data["staff_name"] = self.staff.full_name
            data["staff_number"] = self.staff.staff_number
            data["department"] = self.staff.department.name if self.staff.department else None
        return data
