# ============================================================================
# MODEL: audit_logs
# Columns: log_id, user_id (FK), action, table_affected, timestamp, ip_address
# ----------------------------------------------------------------------------
# Rows are append-only. The API never lets anyone edit or delete audit logs.
# ============================================================================
from datetime import datetime
from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    log_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    # Nullable so we can also log failed logins where no user is authenticated.
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True
    )
    action = db.Column(db.String(60), nullable=False)          # e.g. LOGIN, CREATE_STAFF
    table_affected = db.Column(db.String(60), nullable=True)   # e.g. staff, attendance
    details = db.Column(db.String(255), nullable=True)         # human-readable summary
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    ip_address = db.Column(db.String(45), nullable=True)       # supports IPv6

    user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "log_id": self.log_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "system",
            "action": self.action,
            "table_affected": self.table_affected,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
            "ip_address": self.ip_address,
        }
