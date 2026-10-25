# ============================================================================
# MODEL: departments
# Columns: department_id, name, description
# ============================================================================
from app.extensions import db


class Department(db.Model):
    __tablename__ = "departments"

    department_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    description = db.Column(db.String(255), nullable=True)

    # One department has many staff. `back_populates` keeps both sides in sync.
    staff = db.relationship("Staff", back_populates="department", lazy="selectin")

    def to_dict(self) -> dict:
        """Serialise for JSON responses (plus a computed staff count)."""
        return {
            "department_id": self.department_id,
            "name": self.name,
            "description": self.description,
            "staff_count": len(self.staff),
        }
