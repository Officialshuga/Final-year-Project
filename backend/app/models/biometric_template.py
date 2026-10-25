# ============================================================================
# MODEL: biometric_templates
# Columns: template_id, staff_id (FK), finger_type, template_data (ENCRYPTED),
#          date_enrolled
# ----------------------------------------------------------------------------
# SECURITY: `template_data` is stored ENCRYPTED (AES/Fernet). The raw template
# is NEVER returned by the API. Only the attendance matching service decrypts it
# in memory to compare against an incoming scan.
# ============================================================================
from datetime import datetime
from app.extensions import db


class BiometricTemplate(db.Model):
    __tablename__ = "biometric_templates"
    __table_args__ = (
        # A staff member can enrol each finger only once.
        db.UniqueConstraint("staff_id", "finger_type", name="uq_staff_finger"),
    )

    template_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    staff_id = db.Column(
        db.Integer, db.ForeignKey("staff.staff_id", ondelete="CASCADE"), nullable=False, index=True
    )
    finger_type = db.Column(db.String(40), nullable=False)  # e.g. "Right Index"

    # Encrypted blob. LONGBLOB on MySQL via LargeBinary. Never serialised out.
    template_data = db.Column(db.LargeBinary, nullable=False)

    # Optional quality score captured at enrolment time (0-100).
    quality_score = db.Column(db.Integer, nullable=True)
    date_enrolled = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    staff = db.relationship("Staff", back_populates="templates")

    def to_dict(self) -> dict:
        """NOTE: deliberately omits `template_data` (raw biometric)."""
        return {
            "template_id": self.template_id,
            "staff_id": self.staff_id,
            "finger_type": self.finger_type,
            "quality_score": self.quality_score,
            "date_enrolled": self.date_enrolled.isoformat(),
        }
