# ============================================================================
# MODEL: holidays
# Columns: holiday_id, date (unique), name
# Public holidays / non-working days. Used by attendance calculation, the
# absent-marking job, and reports so these days are never marked "absent".
# ============================================================================
from app.extensions import db


class Holiday(db.Model):
    __tablename__ = "holidays"

    holiday_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    date = db.Column(db.Date, nullable=False, unique=True, index=True)
    name = db.Column(db.String(120), nullable=False)

    def to_dict(self) -> dict:
        return {
            "holiday_id": self.holiday_id,
            "date": self.date.isoformat(),
            "name": self.name,
        }

    @staticmethod
    def is_holiday(d) -> bool:
        return Holiday.query.filter_by(date=d).first() is not None
