# ============================================================================
# FILE: app/utils/password_gen.py
# PURPOSE: Generate strong temporary passwords + validate password strength.
# ============================================================================
import secrets
import re

UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ"   # no I/O/L (avoid confusion)
LOWER = "abcdefghijkmnpqrstuvwxyz"   # no l
DIGIT = "23456789"                    # no 0/1
SYMBOL = "!@#$%^&*?-_"


def generate_temp_password(length: int = 12) -> str:
    """Random temp password, >=10 chars, with at least one of each type."""
    length = max(length, 10)
    required = [
        secrets.choice(UPPER), secrets.choice(LOWER),
        secrets.choice(DIGIT), secrets.choice(SYMBOL),
    ]
    alphabet = UPPER + LOWER + DIGIT + SYMBOL
    rest = [secrets.choice(alphabet) for _ in range(length - len(required))]
    chars = required + rest
    # Shuffle so the required chars aren't always at the front.
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def password_issues(pw: str) -> list[str]:
    """Return a list of unmet strength rules (empty = strong enough)."""
    issues = []
    if len(pw) < 10:
        issues.append("at least 10 characters")
    if not re.search(r"[A-Z]", pw):
        issues.append("one uppercase letter")
    if not re.search(r"[a-z]", pw):
        issues.append("one lowercase letter")
    if not re.search(r"[0-9]", pw):
        issues.append("one number")
    if not re.search(r"[^A-Za-z0-9]", pw):
        issues.append("one symbol")
    return issues
