# ============================================================================
# FILE: bridge/bridge.py
# PURPOSE: The local bridge HTTP service. Runs on the scan-station PC, talks to
#          the USB sensor via sensors.py, and exposes 3 simple endpoints the
#          kiosk can call:
#            GET  /status   -> is the sensor connected?
#            POST /capture  -> capture a fingerprint {template, quality}
#            POST /cancel   -> cancel an in-progress capture
# ----------------------------------------------------------------------------
# SECURITY:
#   - Binds to 127.0.0.1 ONLY, so no other machine on the network can reach it.
#   - Requires a shared secret token (X-Bridge-Token header) so other local
#     programs can't call it either.
#   - CORS is limited to the kiosk origin.
# ============================================================================
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from sensors import make_sensor, SensorError

load_dotenv()

BRIDGE_TOKEN = os.getenv("BRIDGE_TOKEN", "")
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "5050"))
SENSOR_KIND = os.getenv("BRIDGE_SENSOR", "simulated")
TIMEOUT = int(os.getenv("CAPTURE_TIMEOUT", "10"))
MIN_QUALITY = int(os.getenv("MIN_QUALITY", "55"))
KIOSK_ORIGIN = os.getenv("KIOSK_ORIGIN", "http://localhost:5173")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [KIOSK_ORIGIN]}})

# Create the sensor once at startup (lazy re-init happens inside capture()).
try:
    sensor = make_sensor(SENSOR_KIND, TIMEOUT, MIN_QUALITY)
    _init_error = None
except SensorError as e:
    sensor = None
    _init_error = e  # report on /status instead of crashing the bridge


def _check_token():
    """Return None if the token is valid, else a (response, status) tuple."""
    token = request.headers.get("X-Bridge-Token", "")
    if not BRIDGE_TOKEN or token != BRIDGE_TOKEN:
        return jsonify({"error": "Unauthorized", "message": "Invalid bridge token"}), 401
    return None


@app.get("/status")
def status():
    denied = _check_token()
    if denied:
        return denied
    if sensor is None:
        return jsonify({"connected": False, "sensor": SENSOR_KIND,
                        "error": _init_error.code if _init_error else "NO_DEVICE",
                        "message": _init_error.message if _init_error else "Sensor not available"}), 200
    try:
        return jsonify(sensor.status()), 200
    except SensorError as e:
        return jsonify({"connected": False, "sensor": SENSOR_KIND,
                        "error": e.code, "message": e.message}), 200


@app.post("/capture")
def capture():
    denied = _check_token()
    if denied:
        return denied
    if sensor is None:
        return jsonify({"error": _init_error.code if _init_error else "NO_DEVICE",
                        "message": _init_error.message if _init_error else "Sensor not available"}), 503
    try:
        result = sensor.capture()  # {template, quality}
        return jsonify(result), 200
    except SensorError as e:
        # Clear, specific errors: NO_DEVICE / NO_FINGER / LOW_QUALITY / TIMEOUT
        http = 503 if e.code in ("NO_DEVICE", "SDK_MISSING") else 422
        return jsonify({"error": e.code, "message": e.message}), http


@app.post("/cancel")
def cancel():
    denied = _check_token()
    if denied:
        return denied
    if sensor is not None:
        try:
            sensor.cancel()
        except SensorError:
            pass
    return jsonify({"cancelled": True}), 200


if __name__ == "__main__":
    # 127.0.0.1 = localhost only. NEVER use 0.0.0.0 here.
    print(f"[bridge] sensor={SENSOR_KIND} listening on http://127.0.0.1:{BRIDGE_PORT}")
    app.run(host="127.0.0.1", port=BRIDGE_PORT)
