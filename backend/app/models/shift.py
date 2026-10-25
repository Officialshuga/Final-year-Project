# ============================================================================
# MODEL: shifts
# Columns: shift_id, shift_name, start_time, end_time, grace_period_minutes
# ============================================================================
from datetime import datetime, timedelta
from app.extensions import db


class Shift(db.Model):
    __tablename__ = "shifts"

    shift_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    shift_name = db.Column(db.String(120), nullable=False, unique=True)
    start_time = db.Column(db.Time, nullable=False)   # e.g. 08:00
    end_time = db.Column(db.Time, nullable=False)     # e.g. 16:00
    grace_period_minutes = db.Column(db.Integer, nullable=False, default=0)
    # Optional per-shift working days as JSON "[0,1,2,3,4]" (Mon=0..Sun=6).
    # NULL means "use the organisation-wide working days setting".
    working_days = db.Column(db.String(40), nullable=True)

    def crosses_midnight(self) -> bool:
        """True for night shifts (e.g. 20:00 -> 06:00)."""
        return self.start_time > self.end_time

    staff = db.relationship("Staff", back_populates="shift", lazy="selectin")

    def late_cutoff(self):
        """
        Returns the time after which an arrival is counted as 'Late'
        = start_time + grace_period_minutes.
        """
        base = datetime.combine(datetime.today(), self.start_time)
        return (base + timedelta(minutes=self.grace_period_minutes)).time()

    def working_days_list(self):
        """Parse the per-shift working days, or None to use the org default."""
        if not self.working_days:
            return None
        import json
        try:
            return json.loads(self.working_days)
        except (ValueError, TypeError):
            return None

    def to_dict(self) -> dict:
        return {
            "shift_id": self.shift_id,
            "shift_name": self.shift_name,
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
            "grace_period_minutes": self.grace_period_minutes,
            "late_after": self.late_cutoff().strftime("%H:%M"),
            "crosses_midnight": self.crosses_midnight(),
            "working_days": self.working_days_list(),
        }
