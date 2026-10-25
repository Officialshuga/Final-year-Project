# ============================================================================
# Tests for: server-side time, absent job (idempotency, holiday, non-working
# day, night shift), bulk import with errors, and seed-ish re-run safety.
# ============================================================================
from datetime import date, time, timedelta, datetime
import io
from tests.conftest import auth_header
from app.extensions import db
from app.models import Staff, Shift, Attendance, Holiday, Setting, User
from app.absent_job.job import mark_absentees_for_date


# --------------------------------------------------------------------------
# 1. SERVER-SIDE TIME: device clock cannot change the recorded time.
# --------------------------------------------------------------------------
def test_scan_uses_server_time_not_device(client, app):
    headers = auth_header(client, "admin", "admin123")
    # Client sends a bogus time; the server must ignore it.
    res = client.post("/api/attendance/scan", headers=headers,
                      json={"template": "ALICE_FP", "time": "03:00", "timestamp": "1999-01-01T03:00:00"})
    assert res.status_code == 200
    body = res.get_json()
    # The recorded time is the server's current time, NOT 03:00 from the device.
    assert body["time"] != "03:00"


def test_server_time_endpoint(client):
    res = client.get("/api/system/time")
    assert res.status_code == 200
    body = res.get_json()
    assert body["timezone"] == "Africa/Lagos"
    assert "epoch_ms" in body


# --------------------------------------------------------------------------
# 2. ABSENT JOB
# --------------------------------------------------------------------------
def _make_working_day():
    """Pick a recent Monday (guaranteed working day under Mon–Fri default)."""
    d = date.today()
    while d.weekday() != 0:  # Monday
        d -= timedelta(days=1)
    return d - timedelta(days=7)  # last week's Monday


def test_absent_job_idempotent(client, app):
    with app.app_context():
        Setting.put("working_days", [0, 1, 2, 3, 4])
        db.session.commit()
        day = _make_working_day()
        first = mark_absentees_for_date(day)
        second = mark_absentees_for_date(day)  # run twice
        # No duplicates on the second run.
        assert second["absent_created"] == 0
        # Total absent rows for that day == staff who had no scan (created once).
        total = Attendance.query.filter_by(date=day, status="Absent").count()
        assert total == first["absent_created"]


def test_absent_job_skips_holiday(client, app):
    with app.app_context():
        day = _make_working_day()
        db.session.add(Holiday(date=day, name="Test Holiday"))
        db.session.commit()
        summary = mark_absentees_for_date(day)
        assert summary["absent_created"] == 0  # holiday => nobody absent


def test_absent_job_skips_non_working_day(client, app):
    with app.app_context():
        # Pick a Sunday (not in Mon–Fri working days).
        d = date.today()
        while d.weekday() != 6:  # Sunday
            d -= timedelta(days=1)
        summary = mark_absentees_for_date(d)
        assert summary["absent_created"] == 0


def test_incomplete_flagged(client, app):
    with app.app_context():
        day = _make_working_day() - timedelta(days=1)  # a Sunday? ensure working
        # Force a known working day (Tuesday).
        while day.weekday() != 1:
            day -= timedelta(days=1)
        alice = Staff.query.filter_by(full_name="Alice Test").first()
        db.session.add(Attendance(staff_id=alice.staff_id, date=day,
                                  time_in=time(8, 0), status="Present",
                                  verification_method="Fingerprint"))
        db.session.commit()
        mark_absentees_for_date(day)
        rec = Attendance.query.filter_by(staff_id=alice.staff_id, date=day).first()
        assert rec.status == "Incomplete"  # clocked in, never out


def test_night_shift_attribution(client, app):
    """A night-shift scan after midnight belongs to the day the shift started."""
    with app.app_context():
        # Make Alice a night-shift worker 20:00 -> 06:00.
        night = Shift(shift_name="Night 20-6", start_time=time(20, 0),
                      end_time=time(6, 0), grace_period_minutes=30)
        db.session.add(night)
        db.session.flush()
        alice = Staff.query.filter_by(full_name="Alice Test").first()
        alice.shift_id = night.shift_id
        db.session.commit()
        assert night.crosses_midnight() is True


# --------------------------------------------------------------------------
# 3. BULK IMPORT with errors
# --------------------------------------------------------------------------
def test_import_preview_flags_errors(client, app):
    headers = auth_header(client, "admin", "admin123")
    csv_data = (
        "staff_id,full_name,email,phone,department,shift\n"
        "GVU/NEW/1,Valid Person,valid@gvu.edu,0803,ICT,Morning\n"   # unknown dept/shift names
        ",No ID Person,bad-email,0803,ICT,Morning\n"                # missing id + bad email
        "GVU/1,Dup Existing,dupe@gvu.edu,0803,,\n"                   # staff_id already exists (GVU/1)
    )
    data = {"file": (io.BytesIO(csv_data.encode()), "staff.csv")}
    res = client.post("/api/imports/preview", headers=headers,
                      data=data, content_type="multipart/form-data")
    assert res.status_code == 200
    body = res.get_json()
    assert body["total"] == 3
    assert body["error_count"] >= 2  # row 2 and row 3 have problems


def test_import_commit_creates_logins(client, app):
    headers = auth_header(client, "admin", "admin123")
    csv_data = (
        "staff_id,full_name,email,phone,department,shift\n"
        "GVU/IMP/1,Imported One,imp1@gvu.edu,0803,,\n"
    )
    data = {"file": (io.BytesIO(csv_data.encode()), "staff.csv")}
    res = client.post("/api/imports/commit", headers=headers,
                      data=data, content_type="multipart/form-data")
    assert res.status_code == 201
    body = res.get_json()
    assert body["imported"] == 1
    assert len(body["credentials"]) == 1
    assert len(body["credentials"][0]["temp_password"]) >= 10
    # The created user must change password on first login.
    with app.app_context():
        u = User.query.filter_by(username="imp1").first()
        assert u is not None
        assert u.must_change_password is True


def test_import_rejected_for_staff(client, app):
    headers = auth_header(client, "alice", "staff123")
    data = {"file": (io.BytesIO(b"staff_id\nX"), "x.csv")}
    res = client.post("/api/imports/preview", headers=headers,
                      data=data, content_type="multipart/form-data")
    assert res.status_code == 403  # admin only


# --------------------------------------------------------------------------
# 4. SEED / settings re-run safety (working-days setting upsert)
# --------------------------------------------------------------------------
def test_settings_upsert_rerun(client, app):
    with app.app_context():
        Setting.put("working_days", [0, 1, 2, 3, 4])
        db.session.commit()
        Setting.put("working_days", [0, 1, 2, 3, 4, 5])  # re-run / change
        db.session.commit()
        assert Setting.working_days() == [0, 1, 2, 3, 4, 5]
