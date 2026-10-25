# ============================================================================
# Tests: fingerprint scan identification + clock-in/out rules.
#   - valid scan (clock in -> Present/Late)
#   - unknown fingerprint
#   - duplicate sign-in (clock out then duplicate)
#   - late arrival logic
# ============================================================================
from datetime import time
from tests.conftest import auth_header
from app.extensions import db
from app.models import Staff, Shift


def _scan(client, headers, template):
    return client.post("/api/attendance/scan", headers=headers, json={"template": template})


def test_valid_scan_checks_in(client):
    headers = auth_header(client, "admin", "admin123")
    res = _scan(client, headers, "ALICE_FP")  # matches Alice's enrolled template
    assert res.status_code == 200
    body = res.get_json()
    assert body["action"] == "check_in"
    assert body["staff_name"] == "Alice Test"
    assert body["status"] in ("Present", "Late")


def test_unknown_fingerprint(client):
    headers = auth_header(client, "admin", "admin123")
    res = _scan(client, headers, "SOMETHING_ELSE_ENTIRELY_XYZ")
    assert res.status_code == 404
    assert res.get_json()["error"] == "NoMatch"


def test_second_scan_checks_out_then_duplicate(client):
    headers = auth_header(client, "admin", "admin123")
    # 1st scan: check in
    assert _scan(client, headers, "ALICE_FP").get_json()["action"] == "check_in"
    # 2nd scan: check out
    out = _scan(client, headers, "ALICE_FP")
    assert out.status_code == 200
    assert out.get_json()["action"] == "check_out"
    # 3rd scan: duplicate (already in and out)
    dup = _scan(client, headers, "ALICE_FP")
    assert dup.status_code == 409
    assert dup.get_json()["action"] == "duplicate"


def test_late_arrival_logic(client, app):
    # Force Alice's shift grace to start very early so "now" counts as Late.
    with app.app_context():
        shift = Shift.query.first()
        shift.start_time = time(0, 0)
        shift.grace_period_minutes = 0  # cutoff = 00:00, so any real time is Late
        db.session.commit()
    headers = auth_header(client, "admin", "admin123")
    res = _scan(client, headers, "ALICE_FP")
    assert res.status_code == 200
    assert res.get_json()["status"] == "Late"
