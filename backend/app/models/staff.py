# ============================================================================
# MODEL: staff
# Columns: staff_id, staff_number, full_name, email, phone, gender,
#          department_id (FK), shift_id (FK), designation, status, date_registered
# ============================================================================
from datetime import datetime
from app.extensions import db


class Staff(db.Model):
    __tablename__ = "staff"

    staff_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # Human-friendly unique staff number, e.g. "GVU/2026/001"
    staff_number = db.Column(db.String(50), nullable=False, unique=True, index=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False, unique=True, index=True)
    phone = db.Column(db.String(30), nullable=True)
    gender = db.Column(db.String(10), nullable=True)  # Male / Female / Other

    # Foreign keys. ondelete="SET NULL" keeps staff if a dept/shift is removed.
    department_id = db.Column(
        db.Integer, db.ForeignKey("departments.department_id", ondelete="SET NULL"), nullable=True
    )
    shift_id = db.Column(
        db.Integer, db.ForeignKey("shifts.shift_id", ondelete="SET NULL"), nullable=True
    )

    designation = db.Column(db.String(120), nullable=True)      # job title
    status = db.Column(db.String(20), nullable=False, default="Active")  # Active / Inactive
    date_registered = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # --- Relationships ---
    department = db.relationship("Department", back_populates="staff", lazy="joined")
    shift = db.relationship("Shift", back_populates="staff", lazy="joined")
    # Deleting a staff row cascades to their biometrics/attendance/login.
    templates = db.relationship(
        "BiometricTemplate", back_populates="staff", cascade="all, delete-orphan", lazy="selectin"
    )
    attendance = db.relationship(
        "Attendance", back_populates="staff", cascade="all, delete-orphan", lazy="selectin"
    )
    user = db.relationship(
        "User", back_populates="staff", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def enrolled(self) -> bool:
        """True if this staff member has at least one fingerprint enrolled."""
        return len(self.templates) > 0

    def to_dict(self, include_enrolment: bool = True) -> dict:
        data = {
            "staff_id": self.staff_id,
            "staff_number": self.staff_number,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "gender": self.gender,
            "department_id": self.department_id,
            "department": self.department.name if self.department else None,
            "shift_id": self.shift_id,
            "shift": self.shift.shift_name if self.shift else None,
            "designation": self.designation,
            "status": self.status,
            "date_registered": self.date_registered.isoformat(),
        }
        if include_enrolment:
            data["enrolled"] = self.enrolled
            data["fingers_enrolled"] = len(self.templates)
        return data
