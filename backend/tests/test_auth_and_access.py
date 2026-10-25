# ============================================================================
# Tests: authentication + role/ownership access control.
# ============================================================================
from tests.conftest import login, auth_header


def test_login_success_admin(client):
    res = login(client, "admin", "admin123")
    assert res.status_code == 200
    body = res.get_json()
    assert body["user"]["role"] == "admin"
    assert "access_token" in body and "refresh_token" in body


def test_login_wrong_password(client):
    res = login(client, "admin", "WRONG")
    assert res.status_code == 401


def test_admin_only_route_blocks_staff(client):
    # Staff must NOT list all staff (admin-only route).
    headers = auth_header(client, "alice", "staff123")
    res = client.get("/api/staff", headers=headers)
    assert res.status_code == 403


def test_admin_can_list_staff(client):
    headers = auth_header(client, "admin", "admin123")
    res = client.get("/api/staff", headers=headers)
    assert res.status_code == 200
    assert "staff" in res.get_json()


def test_staff_cannot_read_other_staff_data(client):
    # Bob tries to read Alice's attendance by changing the id in the URL.
    headers = auth_header(client, "bob", "staff123")
    # Alice is staff_id 1 in seed order; Bob is 2. Bob requesting Alice (1).
    res = client.get("/api/attendance/staff/1", headers=headers)
    assert res.status_code == 403


def test_staff_can_read_own_data(client):
    headers = auth_header(client, "bob", "staff123")
    res = client.get("/api/attendance/staff/2", headers=headers)
    assert res.status_code == 200


def test_change_password_flow(client):
    headers = auth_header(client, "alice", "staff123")
    # New password must meet strength rules (>=10 chars, mixed types).
    res = client.post("/api/auth/change-password", headers=headers,
                      json={"current_password": "staff123", "new_password": "NewP@ssw0rd1"})
    assert res.status_code == 200
    # Old password no longer works.
    assert login(client, "alice", "staff123").status_code == 401
    # New password works.
    assert login(client, "alice", "NewP@ssw0rd1").status_code == 200
