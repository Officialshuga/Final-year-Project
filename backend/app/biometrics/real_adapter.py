# ============================================================================
# FILE: app/biometrics/real_adapter.py   (NEW — does not modify the existing
#       simulated adapter)
# PURPOSE: Real fingerprint matching on the SERVER using the vendor SDK.
# ----------------------------------------------------------------------------
# IMPORTANT DIVISION OF WORK:
#   - CAPTURE happens on the SCAN STATION via the local bridge (sensors.py).
#     The server never captures; it only RECEIVES templates over the API.
#   - MATCHING happens here on the server. ZKTeco's DBMatch() (and SecuGen's
#     MatchTemplate()) are pure template-vs-template functions that do NOT need
#     the physical device, so they run fine on the server.
#
# Templates arrive from the kiosk as base64 text, are decoded to bytes, and are
# compared here. Raw templates are only ever held in memory, never logged.
# ============================================================================
from __future__ import annotations
import base64
from flask import current_app
from .service import BiometricService


def _to_bytes(data) -> bytes:
    """Accept base64 string or raw bytes and return raw bytes."""
    if isinstance(data, bytes):
        # It might be base64 stored as bytes; try to decode, fall back to raw.
        try:
            return base64.b64decode(data, validate=True)
        except Exception:
            return data
    if isinstance(data, str):
        try:
            return base64.b64decode(data)
        except Exception:
            return data.encode()
    return bytes(data)


class ZkRealBiometricService(BiometricService):
    """
    ZKTeco matching adapter (pyzkfp). Install on the SERVER:  pip install pyzkfp
    DBMatch returns a similarity score; we normalise it to 0..100.
    """

    def __init__(self):
        self._zk = None
        try:
            from zkfp import ZKFP2
            self._zk = ZKFP2()
            self._zk.Init()  # needed so DBMatch is available; no device required
        except Exception as e:
            # Don't crash the whole app at import time; fail clearly when used.
            self._init_error = str(e)
        else:
            self._init_error = None

    def capture(self) -> bytes:
        # The server never captures — the bridge does. Make that explicit.
        raise NotImplementedError(
            "Server-side capture is not used. Capture happens on the scan "
            "station via the local bridge; the template is POSTed to the API."
        )

    def match(self, probe: bytes, candidate: bytes) -> int:
        if self._zk is None:
            raise RuntimeError(f"ZKTeco SDK not available on server: {self._init_error}")
        p = _to_bytes(probe)
        c = _to_bytes(candidate)
        try:
            raw_score = self._zk.DBMatch(p, c)  # vendor score (0..n)
        except Exception as e:
            raise RuntimeError("ZKTeco DBMatch failed") from e
        # ZK scores are typically 0..~100+. Clamp to 0..100.
        return max(0, min(int(raw_score), 100))


class SecuGenRealBiometricService(BiometricService):
    """
    SecuGen matching adapter (FDx SDK Pro). Implement MatchTemplate() below.
    """

    def __init__(self):
        # TODO(SDK): create SGFPM handle + Init() (no device needed for matching).
        self._init_error = "SecuGen matching not wired yet."

    def capture(self) -> bytes:
        raise NotImplementedError("Capture happens on the scan station bridge.")

    def match(self, probe: bytes, candidate: bytes) -> int:
        # TODO(SDK): matched, score = fpm.MatchTemplate(probe, candidate, level)
        raise RuntimeError(self._init_error)


def get_real_service(vendor: str) -> BiometricService:
    vendor = (vendor or "").lower()
    if vendor == "secugen":
        return SecuGenRealBiometricService()
    return ZkRealBiometricService()  # default real adapter = ZKTeco
