# ============================================================================
# MODEL: users  (login accounts)
# Columns: user_id, username, password_hash, role (admin/staff), staff_id (FK),
#          last_login
# ----------------------------------------------------------------------------
# Extra security columns (failed_attempts, locked_until, reset token) support
# account lockout and password reset. Passwords are hashed with bcrypt.
# ============================================================================
from datetime import datetime
import bcrypt
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="staff")  # 'admin' | 'staff'

    # Admin accounts have staff_id = NULL. Staff accounts link to their record.
    staff_id = db.Column(
        db.Integer, db.ForeignKey("staff.staff_id", ondelete="CASCADE"), nullable=True, unique=True
    )
    last_login = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    # --- Account-lockout fields ---
    failed_attempts = db.Column(db.Integer, nullable=False, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    # --- Password-reset fields (token hashed, never stored in clear) ---
    reset_token_hash = db.Column(db.String(255), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)

    # --- Forced password change after an admin reset ---
    # must_change_password: block everything until the user sets a new password.
    # temp_password_expires: the temp password is only valid for 24 hours.
    # session_epoch: bumped on reset to invalidate all existing JWTs (logout).
    must_change_password = db.Column(db.Boolean, nullable=False, default=False)
    temp_password_expires = db.Column(db.DateTime, nullable=True)
    session_epoch = db.Column(db.Integer, nullable=False, default=0)

    staff = db.relationship("Staff", back_populates="user")

    # ---- Password helpers (bcrypt) ----
    def set_password(self, plain: str) -> None:
        self.password_hash = bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    def check_password(self, plain: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode(), self.password_hash.encode())
        except ValueError:
            return False

    # ---- Lockout helpers ----
    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > datetime.utcnow())

    def temp_password_valid(self) -> bool:
        """True if a temp password is set and still within its 24h window."""
        if not self.must_change_password:
            return True  # not using a temp password
        if not self.temp_password_expires:
            return True
        return self.temp_password_expires > datetime.utcnow()

    def to_dict(self) -> dict:
        """NOTE: never exposes password_hash or reset token."""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "role": self.role,
            "staff_id": self.staff_id,
            "staff_name": self.staff.full_name if self.staff else None,
            "is_active": self.is_active,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "locked": self.is_locked(),
            "must_change_password": self.must_change_password,
        }
