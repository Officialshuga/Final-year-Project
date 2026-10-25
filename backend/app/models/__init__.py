# ============================================================================
# FILE: app/models/__init__.py
# PURPOSE: Import every model so that:
#   1. Flask-Migrate can "see" all tables when generating migrations.
#   2. Other modules can do `from app.models import Staff, User, ...`
# ============================================================================
from .department import Department
from .shift import Shift
from .staff import Staff
from .biometric_template import BiometricTemplate
from .attendance import Attendance
from .user import User
from .audit_log import AuditLog
from .password_reset_request import PasswordResetRequest
from .setting import Setting
from .holiday import Holiday
from .leave_request import LeaveRequest

__all__ = [
    "Department",
    "Shift",
    "Staff",
    "BiometricTemplate",
    "Attendance",
    "User",
    "AuditLog",
    "PasswordResetRequest",
    "Setting",
    "Holiday",
    "LeaveRequest",
]
