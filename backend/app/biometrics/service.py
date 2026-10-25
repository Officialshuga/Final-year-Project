# ============================================================================
# FILE: app/biometrics/service.py
# PURPOSE: BiometricService abstraction + two implementations.
# ----------------------------------------------------------------------------
# WHY AN ABSTRACTION?
#   The rest of the app (enrolment, attendance scan) should NOT care whether a
#   real fingerprint reader or a software simulation produced the template.
#   We depend on the abstract interface and swap the implementation via config
#   (BIOMETRIC_ADAPTER = simulated | zkteco | secugen).
#
# INTERFACE:
#   capture()                 -> bytes            (acquire a template from device)
#   match(probe, candidate)   -> int (0..100)     (similarity score)
# ============================================================================
from __future__ import annotations
import hashlib
from abc import ABC, abstractmethod
from flask import current_app


class BiometricService(ABC):
    """Abstract fingerprint service. Implementations below."""

    @abstractmethod
    def capture(self) -> bytes:
        """Capture a fingerprint template from the hardware (raw bytes)."""

    @abstractmethod
    def match(self, probe: bytes, candidate: bytes) -> int:
        """Return a similarity score 0..100 between two templates."""


# ----------------------------------------------------------------------------
# 1) SIMULATED ADAPTER — no hardware needed (development / tests / demo)
# ----------------------------------------------------------------------------
class SimulatedBiometricService(BiometricService):
    """
    Software-only adapter.

    - capture(): returns a random pseudo-template (used rarely; normally the
      frontend/kiosk sends a template string which we encode to bytes).
    - match(): because simulated templates are deterministic strings, two
      templates that are byte-identical score 100, otherwise we compute a simple
      similarity from a shared hash prefix. This is ENOUGH to demo "same finger =
      match, different finger = no match" without real minutiae matching.
    """

    def capture(self) -> bytes:
        import os
        return os.urandom(32)

    def match(self, probe: bytes, candidate: bytes) -> int:
        if not probe or not candidate:
            return 0
        if probe == candidate:
            return 100
        # Similarity from common leading hash characters (deterministic).
        ph = hashlib.sha256(probe).hexdigest()
        ch = hashlib.sha256(candidate).hexdigest()
        common = 0
        for a, b in zip(ph, ch):
            if a == b:
                common += 1
            else:
                break
        # Map 0..64 common hex chars to 0..100 (tiny prefix matches stay low).
        return min(int(common / 64 * 100), 100)


# ----------------------------------------------------------------------------
# 2) REAL SDK ADAPTER — ZKTeco / SecuGen (integration notes inline)
# ----------------------------------------------------------------------------
class SdkBiometricService(BiometricService):
    """
    Adapter for a real fingerprint SDK.

    INTEGRATION NOTES
    -----------------
    Both ZKTeco and SecuGen ship a native SDK (DLL/.so) with a Python binding
    or a C API you call via ctypes. The exact calls differ, but the shape is:

      ZKTeco (ZKFinger / ZKFPM):
        - initialise:   zkfp2.Init(); open device index 0
        - capture:      zkfp2.AcquireFingerprint() -> (image, template_bytes)
        - match:        zkfp2.DBMatch(a, b) -> score (0..?) ; normalise to 0..100

      SecuGen (FDx SDK Pro):
        - initialise:   SGFPM.Init(); OpenDevice()
        - capture:      GetImage() then CreateTemplate() -> template_bytes
        - match:        MatchTemplate(a, b, security_level) -> matched(bool)+score

    Replace the bodies below with the real SDK calls for your chosen reader.
    Keep returning: capture() -> raw template bytes; match() -> int 0..100.
    """

    def __init__(self):
        self.vendor = current_app.config.get("BIOMETRIC_ADAPTER", "zkteco")
        # TODO(SDK): initialise the device here (Init/OpenDevice) and keep a
        # handle on self._device. Raise a clear error if no reader is attached.

    def capture(self) -> bytes:
        # TODO(SDK): call the vendor capture function and return template bytes.
        raise NotImplementedError(
            f"Real '{self.vendor}' capture not wired yet. Set BIOMETRIC_ADAPTER=simulated "
            "for development, or implement the SDK calls here."
        )

    def match(self, probe: bytes, candidate: bytes) -> int:
        # TODO(SDK): call the vendor match function and normalise score to 0..100.
        raise NotImplementedError(
            f"Real '{self.vendor}' match not wired yet. Set BIOMETRIC_ADAPTER=simulated "
            "for development, or implement the SDK calls here."
        )


# ----------------------------------------------------------------------------
# FACTORY — pick the implementation from config (BIOMETRIC_ADAPTER in .env).
#   simulated          -> software only (no hardware) — unchanged
#   zkteco / secugen   -> REAL matching via real_adapter.py (added separately)
# ----------------------------------------------------------------------------
def get_biometric_service() -> BiometricService:
    adapter = current_app.config.get("BIOMETRIC_ADAPTER", "simulated").lower()
    if adapter in ("zkteco", "secugen", "sdk"):
        # Import lazily so the simulated/dev path never needs the SDK installed.
        from .real_adapter import get_real_service
        return get_real_service(adapter)
    return SimulatedBiometricService()
