# ============================================================================
# FILE: bridge/sensors.py
# PURPOSE: Thin wrappers around the actual fingerprint SDK on the scan station.
#   Each class exposes the SAME 3 methods so the bridge doesn't care which
#   sensor is attached:
#       status()   -> dict: is the sensor connected?
#       capture()  -> dict: {template: str, quality: int}
#       cancel()   -> stop an in-progress capture
# ----------------------------------------------------------------------------
# Beginner note: a "template" is NOT the fingerprint image. It's a small maths
# summary of the fingerprint produced by the SDK. We move templates around as
# base64 text so they are easy to send over HTTP/JSON.
# ============================================================================
import base64
import os
import time


class SensorError(Exception):
    """Raised for any sensor problem; the bridge turns this into a clear JSON error."""
    def __init__(self, code: str, message: str):
        self.code = code          # e.g. "NO_DEVICE", "NO_FINGER", "LOW_QUALITY", "TIMEOUT"
        self.message = message
        super().__init__(message)


# ----------------------------------------------------------------------------
# 1) ZKTeco adapter (ZK9500 / SLK20R) using the `pyzkfp` Python wrapper.
#    Install on the scan station:  pip install pyzkfp
# ----------------------------------------------------------------------------
class ZKTecoSensor:
    def __init__(self, timeout: int, min_quality: int):
        self.timeout = timeout
        self.min_quality = min_quality
        self._zk = None
        self._device = None
        self._init_device()

    def _init_device(self):
        try:
            from zkfp import ZKFP2  # provided by pyzkfp
        except Exception as e:
            raise SensorError("SDK_MISSING",
                              "ZKTeco SDK (pyzkfp) not installed on this PC.") from e
        try:
            self._zk = ZKFP2()
            self._zk.Init()
            if self._zk.GetDeviceCount() < 1:
                raise SensorError("NO_DEVICE", "No fingerprint sensor detected.")
            self._device = self._zk.OpenDevice(0)
        except SensorError:
            raise
        except Exception as e:
            raise SensorError("NO_DEVICE", "Could not open the fingerprint sensor.") from e

    def status(self) -> dict:
        try:
            connected = self._zk is not None and self._zk.GetDeviceCount() >= 1
        except Exception:
            connected = False
        return {"connected": connected, "sensor": "zkteco"}

    def capture(self) -> dict:
        if not self._zk:
            self._init_device()
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            try:
                capture = self._zk.AcquireFingerprint()  # returns (template, image) or None
            except Exception as e:
                raise SensorError("NO_DEVICE", "Sensor read failed (unplugged?).") from e
            if capture:
                template_bytes, _image = capture
                # ZK gives a quality via GetImageQuality on some SDK builds; if not,
                # derive a simple proxy from template length. Adjust to your SDK.
                quality = getattr(self._zk, "last_quality", None) or min(100, max(40, len(template_bytes) // 6))
                if quality < self.min_quality:
                    raise SensorError("LOW_QUALITY",
                                      f"Scan quality too low ({quality}). Please try again.")
                template_b64 = base64.b64encode(bytes(template_bytes)).decode()
                return {"template": template_b64, "quality": int(quality)}
            time.sleep(0.2)  # no finger yet; keep waiting until timeout
        raise SensorError("TIMEOUT", "No finger detected. Please try again.")

    def cancel(self):
        # pyzkfp has no explicit cancel; capture() stops at timeout. No-op here.
        return True


# ----------------------------------------------------------------------------
# 2) SecuGen adapter — skeleton. SecuGen ships the FDx SDK Pro (DLL).
#    Call it via the `pysecugen` package or ctypes. Fill in the real calls.
# ----------------------------------------------------------------------------
class SecuGenSensor:
    def __init__(self, timeout: int, min_quality: int):
        self.timeout = timeout
        self.min_quality = min_quality
        # TODO(SDK): initialise FDx SDK: SGFPM Create() -> Init() -> OpenDevice()
        raise SensorError("SDK_MISSING",
                          "SecuGen adapter not wired yet. Implement FDx SDK calls here.")

    def status(self) -> dict:
        return {"connected": False, "sensor": "secugen"}

    def capture(self) -> dict:
        # TODO(SDK): GetImage() -> GetImageQuality() -> CreateTemplate()
        raise SensorError("SDK_MISSING", "SecuGen capture not implemented.")

    def cancel(self):
        return True


# ----------------------------------------------------------------------------
# 3) Simulated sensor — no hardware needed, for testing the bridge itself.
#    Returns a deterministic template so the same "finger" always matches.
# ----------------------------------------------------------------------------
class SimulatedSensor:
    def __init__(self, timeout: int, min_quality: int):
        self.timeout = timeout
        self.min_quality = min_quality

    def status(self) -> dict:
        return {"connected": True, "sensor": "simulated"}

    def capture(self) -> dict:
        # In simulation we let the caller pass a "finger" via env for repeatable
        # tests; otherwise we generate a random template.
        seed = os.getenv("SIM_FINGER", "")
        raw = seed.encode() if seed else os.urandom(32)
        return {"template": base64.b64encode(raw).decode(), "quality": 95}

    def cancel(self):
        return True


# ----------------------------------------------------------------------------
# Factory — choose the sensor from config.
# ----------------------------------------------------------------------------
def make_sensor(kind: str, timeout: int, min_quality: int):
    kind = (kind or "simulated").lower()
    if kind == "zkteco":
        return ZKTecoSensor(timeout, min_quality)
    if kind == "secugen":
        return SecuGenSensor(timeout, min_quality)
    return SimulatedSensor(timeout, min_quality)
