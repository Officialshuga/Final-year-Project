# ============================================================================
# FILE: app/utils/crypto.py
# PURPOSE: Symmetric encryption (AES via Fernet) for biometric templates.
# ----------------------------------------------------------------------------
# Fernet = AES-128-CBC + HMAC-SHA256 authentication, from the `cryptography`
# library. The key comes from BIOMETRIC_ENC_KEY in .env and is NEVER hard-coded.
#
# Usage:
#   enc = encrypt_bytes(raw_template_bytes)   # store `enc` in the DB
#   raw = decrypt_bytes(enc)                   # only in memory during matching
# ============================================================================
from flask import current_app
from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    """Build a Fernet instance from the configured key (validated)."""
    key = current_app.config.get("BIOMETRIC_ENC_KEY", "")
    if not key:
        raise RuntimeError(
            "BIOMETRIC_ENC_KEY is not set. Generate one with:\n"
            '  python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    # Fernet expects bytes.
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_bytes(raw: bytes) -> bytes:
    """Encrypt raw template bytes for safe storage."""
    if isinstance(raw, str):
        raw = raw.encode()
    return _fernet().encrypt(raw)


def decrypt_bytes(token: bytes) -> bytes:
    """Decrypt stored template bytes. Raises ValueError if tampered/invalid."""
    try:
        return _fernet().decrypt(token)
    except InvalidToken as exc:
        raise ValueError("Could not decrypt biometric template (invalid key or data).") from exc
