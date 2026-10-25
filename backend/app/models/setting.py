# ============================================================================
# MODEL: settings  (simple key/value store for org-wide configuration)
# Used for: working_days (which weekdays are working days), and future settings.
# ----------------------------------------------------------------------------
# working_days is stored as a JSON list of weekday numbers (Mon=0 .. Sun=6),
# e.g. [0,1,2,3,4] = Monday–Friday.
# ============================================================================
import json
from app.extensions import db


class Setting(db.Model):
    __tablename__ = "settings"

    key = db.Column(db.String(60), primary_key=True)
    value = db.Column(db.Text, nullable=False)

    @staticmethod
    def get(key: str, default=None):
        row = Setting.query.get(key)
        if not row:
            return default
        try:
            return json.loads(row.value)
        except (ValueError, TypeError):
            return row.value

    @staticmethod
    def put(key: str, value) -> None:
        row = Setting.query.get(key)
        payload = json.dumps(value)
        if row:
            row.value = payload
        else:
            db.session.add(Setting(key=key, value=payload))

    # Defaults ----------------------------------------------------------------
    DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4]  # Mon–Fri

    @staticmethod
    def working_days() -> list[int]:
        return Setting.get("working_days", Setting.DEFAULT_WORKING_DAYS)
