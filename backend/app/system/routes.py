# ============================================================================
# BLUEPRINT: system  (prefix: /api/system)
#   GET /time  -> the authoritative SERVER time (public, no auth).
#                 The scan kiosk calls this on load and every few minutes to
#                 sync its live clock, so the displayed clock matches the server
#                 and never trusts the device clock.
# ============================================================================
from flask import Blueprint, jsonify
from app.utils.clock import now_utc, lagos_now

system_bp = Blueprint("system", __name__, url_prefix="/api/system")


@system_bp.get("/time")
def server_time():
    utc = now_utc()
    lagos = lagos_now()
    return jsonify({
        "utc": utc.isoformat(),
        "timezone": "Africa/Lagos",
        "local": lagos.isoformat(),
        "local_time": lagos.strftime("%H:%M:%S"),
        "local_date": lagos.strftime("%Y-%m-%d"),
        # epoch ms lets the frontend compute drift and keep ticking locally.
        "epoch_ms": int(utc.timestamp() * 1000),
    }), 200
