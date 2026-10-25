# ============================================================================
# Tests: password reset request flow + forced change + expiry + access control.
# Covers Section 7 test cases.
# ============================================================================
from datetime import datetime, timedelta
from tests.conftest import auth_header
from app.extensions import db
from app.models import PasswordResetRequest, Staff, User


def _submit(client, staff_id, message=""):
    return client.post("/api/password-requests", json={"staff_id": staff_id, "message": message})


# --- valid staff ID: request is stored, generic message returned ---
def test_valid_staff_id_request(client, app):
    res = _submit(client, "GVU/1")  # Alice's staff_number in seed
    assert res.status_code == 202
    assert "If this account exists" in res.get_json()["message"]
    with app.app_context():
        assert PasswordResetRequest.query.filter(
            PasswordResetRequest.submitted_identifier == "GVU/1").count() == 1


# --- invalid staff ID: SAME message, no enumeration ---
def test_invalid_staff_id_same_message(client):
    valid = _submit(client, "GVU/1").get_json()["message"]
    invalid = _submit(client, "DOES-NOT-EXIST").get_json()["message"]
    assert valid == invalid  # identical response => cannot enumerate


# --- duplicate pending requests are ignored ---
def test_duplicate_requests_ignored(client, app):
    _submit(client, "GVU/2")
    _submit(client, "GVU/2")
    with app.app_context():
        count = PasswordResetRequest.query.filter(
            PasswordResetRequest.submitted_identifier == "GVU/2",
            PasswordResetRequest.status == "pending").count()
        assert count == 1


# --- staff cannot open the admin requests list ---
def test_staff_cannot_view_requests(client):
    headers = auth_header(client, "alice", "staff123")
    res = client.get("/api/password-requests", headers=headers)
    assert res.status_code == 403


# --- admin can view + reset, temp password returned once ---
def test_admin_reset_returns_temp_password(client, app):
    _submit(client, "GVU/1")
    headers = auth_header(client, "admin", "admin123")
    listing = client.get("/api/password-requests?status=pending", headers=headers).get_json()
    req_id = listing["requests"][0]["id"]
    res = client.patch(f"/api/password-requests/{req_id}/reset", headers=headers)
    assert res.status_code == 200
    body = res.get_json()
    assert len(body["temp_password"]) >= 10
    assert body["expires_in_hours"] == 24


# --- forced password change on first login after reset ---
def test_forced_change_after_reset(client, app):
    _submit(client, "GVU/1")
    admin = auth_header(client, "admin", "admin123")
    rid = client.get("/api/password-requests?status=pending", headers=admin).get_json()["requests"][0]["id"]
    temp = client.patch(f"/api/password-requests/{rid}/reset", headers=admin).get_json()["temp_password"]

    # Login with temp password works but flags must_change_password.
    login = client.post("/api/auth/login", json={"username": "alice", "password": temp})
    assert login.status_code == 200
    assert login.get_json()["must_change_password"] is True
    tok = {"Authorization": f"Bearer {login.get_json()['access_token']}"}

    # Blocked from normal routes until changed.
    blocked = client.get("/api/attendance/staff/1", headers=tok)
    assert blocked.status_code == 403
    assert blocked.get_json()["error"] == "PasswordChangeRequired"

    # Change password (strong) is allowed and clears the flag.
    ch = client.post("/api/auth/change-password", headers=tok,
                     json={"current_password": temp, "new_password": "Str0ng#Pass9"})
    assert ch.status_code == 200
    # Now a fresh login is NOT forced to change.
    relog = client.post("/api/auth/login", json={"username": "alice", "password": "Str0ng#Pass9"})
    assert relog.get_json()["must_change_password"] is False


# --- expired temporary password is rejected at login ---
def test_expired_temp_password(client, app):
    admin = auth_header(client, "admin", "admin123")
    # Reset Alice directly via users route (user_id 2 in seed: admin=1, alice=2).
    res = client.patch("/api/users/2/reset-password", headers=admin)
    temp = res.get_json()["temp_password"]
    # Force-expire the temp password.
    with app.app_context():
        u = User.query.filter_by(username="alice").first()
        u.temp_password_expires = datetime.utcnow() - timedelta(hours=1)
        db.session.commit()
    login = client.post("/api/auth/login", json={"username": "alice", "password": temp})
    assert login.status_code == 403
    assert login.get_json()["error"] == "Expired"
