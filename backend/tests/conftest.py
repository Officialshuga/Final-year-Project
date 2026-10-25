# ============================================================================
# FILE: tests/conftest.py
# PURPOSE: Shared pytest fixtures — an app bound to an in-memory SQLite DB,
#          a test client, and seeded admin + staff with an enrolled finger.
# ============================================================================
import pytest
from config import TestingConfig
from app import create_app
from app.extensions import db as _db
from app.models import User, Staff, Department, Shift, BiometricTemplate
from app.utils.crypto import encrypt_bytes
from datetime import time, datetime


@pytest.fixture()
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        _db.create_all()
        _seed()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _seed():
    # Admin
    admin = User(username="admin", role="admin", is_active=True)
    admin.set_password("admin123")
    _db.session.add(admin)

    # Department + shift
    dept = Department(name="ICT", description="Tech")
    shift = Shift(shift_name="Morning", start_time=time(8, 0), end_time=time(16, 0),
                  grace_period_minutes=30)
    _db.session.add_all([dept, shift])
    _db.session.flush()

    # Staff A (enrolled) + login
    staff_a = Staff(staff_number="GVU/1", full_name="Alice Test", email="alice@gvu.edu",
                    department_id=dept.department_id, shift_id=shift.shift_id,
                    status="Active", date_registered=datetime.utcnow())
    _db.session.add(staff_a)
    _db.session.flush()
    ua = User(username="alice", role="staff", staff_id=staff_a.staff_id, is_active=True)
    ua.set_password("staff123")
    _db.session.add(ua)

    # Staff B (for cross-access tests) + login
    staff_b = Staff(staff_number="GVU/2", full_name="Bob Test", email="bob@gvu.edu",
                    department_id=dept.department_id, shift_id=shift.shift_id,
                    status="Active", date_registered=datetime.utcnow())
    _db.session.add(staff_b)
    _db.session.flush()
    ub = User(username="bob", role="staff", staff_id=staff_b.staff_id, is_active=True)
    ub.set_password("staff123")
    _db.session.add(ub)

    # Enrol Alice's Right Index with a known template "ALICE_FP".
    tmpl = BiometricTemplate(
        staff_id=staff_a.staff_id, finger_type="Right Index",
        template_data=encrypt_bytes(b"ALICE_FP"), quality_score=95,
        date_enrolled=datetime.utcnow(),
    )
    _db.session.add(tmpl)
    _db.session.commit()


# ---- auth helpers ----
def login(client, username, password):
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    return res


def auth_header(client, username, password):
    res = login(client, username, password)
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
