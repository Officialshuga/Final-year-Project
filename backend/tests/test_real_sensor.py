# ============================================================================
# Tests for the real-sensor integration layer (Section 8).
# These test the SERVER-side pieces that don't need physical hardware:
#   - enrolment with multiple samples + low-quality rejection
#   - correct match / wrong finger (via simulated adapter which is deterministic)
#   - duplicate scan prevention
#   - matching speed with many staff (cache)
#   - switching adapters via config
# ============================================================================
import base64
import time
from tests.conftest import auth_header
from app.extensions import db
from app.models import Staff, BiometricTemplate, User
from app.utils.crypto import encrypt_bytes


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


# --- successful multi-sample enrolment ---
def test_enroll_multisample_success(client, app):
    headers = auth_header(client, "admin", "admin123")
    # Bob is staff_id 2 in the seed.
    res = client.post("/api/biometrics/enroll", headers=headers, json={
        "staff_id": 2, "finger_type": "Right Thumb",
        "samples": [
            {"template": _b64("BOB_FP"), "quality": 90},
            {"template": _b64("BOB_FP"), "quality": 88},
            {"template": _b64("BOB_FP"), "quality": 92},
        ],
    })
    assert res.status_code == 201
    # Raw template never returned.
    assert "template_data" not in res.get_json()["template"]


# --- poor-quality scan rejected ---
def test_enroll_low_quality_rejected(client, app):
    headers = auth_header(client, "admin", "admin123")
    res = client.post("/api/biometrics/enroll", headers=headers, json={
        "staff_id": 2, "finger_type": "Left Index",
        "samples": [
            {"template": _b64("x"), "quality": 10},
            {"template": _b64("x"), "quality": 20},
        ],
    })
    assert res.status_code == 422
    assert res.get_json()["error"] == "LowQuality"


# --- correct match identifies the right staff (simulated adapter) ---
def test_correct_match(client, app):
    headers = auth_header(client, "admin", "admin123")
    # Alice enrolled "ALICE_FP" (bytes) in conftest; simulated match is exact.
    res = client.post("/api/attendance/scan", headers=headers,
                      json={"template": "ALICE_FP"})
    assert res.status_code == 200
    assert res.get_json()["staff_name"] == "Alice Test"


# --- wrong finger / unknown template -> not recognised ---
def test_wrong_finger_no_match(client, app):
    headers = auth_header(client, "admin", "admin123")
    res = client.post("/api/attendance/scan", headers=headers,
                      json={"template": "TOTALLY_DIFFERENT_FINGER"})
    assert res.status_code == 404
    assert res.get_json()["error"] == "NoMatch"


# --- duplicate scan prevented ---
def test_duplicate_scan(client, app):
    headers = auth_header(client, "admin", "admin123")
    client.post("/api/attendance/scan", headers=headers, json={"template": "ALICE_FP"})  # in
    client.post("/api/attendance/scan", headers=headers, json={"template": "ALICE_FP"})  # out
    dup = client.post("/api/attendance/scan", headers=headers, json={"template": "ALICE_FP"})
    assert dup.status_code == 409


# --- matching speed with many staff (cache keeps it fast) ---
def test_matching_speed_many_staff(client, app):
    with app.app_context():
        # Add 300 staff each with a distinct enrolled template.
        for i in range(300):
            s = Staff(staff_number=f"PERF/{i}", full_name=f"Perf {i}",
                      email=f"perf{i}@gvu.edu", status="Active")
            db.session.add(s)
            db.session.flush()
            db.session.add(BiometricTemplate(
                staff_id=s.staff_id, finger_type="Right Index",
                template_data=encrypt_bytes(f"PERF_FP_{i}".encode()), quality_score=90))
        db.session.commit()
    # Invalidate cache so it rebuilds with the new rows.
    from app.biometrics.template_cache import invalidate
    invalidate()

    headers = auth_header(client, "admin", "admin123")
    start = time.time()
    res = client.post("/api/attendance/scan", headers=headers, json={"template": "PERF_FP_150"})
    elapsed = time.time() - start
    assert res.status_code == 200
    assert res.get_json()["staff_name"] == "Perf 150"
    # Should be quick even with 300+ templates (generous CI-safe bound).
    assert elapsed < 3.0


# --- manual fallback requires a reason (admin only) ---
def test_manual_requires_reason(client, app):
    headers = auth_header(client, "admin", "admin123")
    bad = client.post("/api/attendance/manual", headers=headers, json={"staff_id": 2})
    assert bad.status_code == 400
    ok = client.post("/api/attendance/manual", headers=headers,
                     json={"staff_id": 2, "reason": "Sensor unplugged at gate"})
    assert ok.status_code == 200


def test_manual_blocked_for_staff(client, app):
    headers = auth_header(client, "alice", "staff123")
    res = client.post("/api/attendance/manual", headers=headers,
                      json={"staff_id": 1, "reason": "x reason"})
    assert res.status_code == 403  # admin only


# --- switching back to the simulated adapter works ---
def test_adapter_switch(app):
    with app.app_context():
        from app.biometrics.service import get_biometric_service, SimulatedBiometricService
        app.config["BIOMETRIC_ADAPTER"] = "simulated"
        svc = get_biometric_service()
        assert isinstance(svc, SimulatedBiometricService)
        # Exact templates match 100 in the simulated adapter.
        assert svc.match(b"SAME", b"SAME") == 100
        assert svc.match(b"ONE", b"TWO") < 100
