# ============================================================================
# FILE: app/biometrics/template_cache.py   (NEW)
# PURPOSE: Keep DECRYPTED templates in memory so 1:N matching stays fast as the
#          number of staff grows (no per-scan decrypt of the whole table).
# ----------------------------------------------------------------------------
# SECURITY:
#   - Lives only in RAM (a module-level dict). Never written to disk or logs.
#   - Invalidated whenever enrolment changes (enroll / re-enroll / delete) so it
#     never serves stale data.
# ----------------------------------------------------------------------------
# Beginner note: decrypting every stored template on every single scan is slow
# with hundreds of staff. We decrypt ONCE, cache in memory, and reuse until
# enrolment changes.
# ============================================================================
import threading
from app.models import BiometricTemplate
from app.utils.crypto import decrypt_bytes

_lock = threading.Lock()
_cache: list[tuple[int, bytes]] | None = None   # list of (staff_id, raw_template)


def load_templates() -> list[tuple[int, bytes]]:
    """Return cached (staff_id, decrypted_template) pairs, building the cache if needed."""
    global _cache
    with _lock:
        if _cache is None:
            pairs = []
            for t in BiometricTemplate.query.all():
                try:
                    pairs.append((t.staff_id, decrypt_bytes(t.template_data)))
                except ValueError:
                    continue  # skip unreadable template (never log its contents)
            _cache = pairs
        return _cache


def invalidate():
    """Drop the cache so the next scan rebuilds it. Call after enrolment changes."""
    global _cache
    with _lock:
        _cache = None
