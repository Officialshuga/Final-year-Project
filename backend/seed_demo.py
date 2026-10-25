# ============================================================================
# FILE: seed_demo.py
# PURPOSE: Fill the database with realistic DEMO data for testing/presentation.
# ----------------------------------------------------------------------------
#   - 1 admin + ~25 staff (Nigerian names) with linked logins
#   - 5 departments, 3 shifts (incl. a night shift)
#   - public holidays
#   - 4–6 weeks of attendance (on-time, late, absent, leave, overtime, incomplete)
#   - leave requests (pending / approved / rejected)
#   - sample audit log entries
#
# SAFE TO RE-RUN: pass --fresh to clear demo data first, otherwise it skips
# records that already exist.
#
# Fingerprint templates are FAKE placeholders — never real biometric data.
#
# RUN:
#   python seed_demo.py            # fill (skip existing)
#   python seed_demo.py --fresh    # wipe demo data, then fill
# ============================================================================
import sys
import random
from datetime import datetime, time, timedelta, date as date_cls

from app import create_app
from app.extensions import db
from app.models import (Department, Shift, Staff, User, Attendance,
                        BiometricTemplate, Holiday, LeaveRequest, AuditLog, Setting)
from app.utils.crypto import encrypt_bytes
from app.utils.calendar_rules import is_working_day

# A marker so demo data can be identified/removed before real use.
DEMO_TAG = "[DEMO]"

NIGERIAN_NAMES = [
    "Adaeze Mensah", "Samuel Okafor", "Joy Adeyemi", "Luka Eze", "Ruth Banda",
    "David Musa", "Fatima Bello", "Grace Tetteh", "Kwame Asante", "Ngozi Umeh",
    "Chinedu Obi", "Aisha Lawal", "Emeka Nwankwo", "Blessing Okon", "Ibrahim Sule",
    "Peace Abiodun", "Tunde Bakare", "Halima Yusuf", "Chidi Anyanwu", "Zainab Garba",
    "Oluwaseun Ade", "Amaka Eze", "Musa Danladi", "Folake Ojo", "Uche Kalu",
]

DEPARTMENTS = [
    ("Information & Communication Tech", "ICT infrastructure & support"),
    ("Human Resources", "Staff welfare and recruitment"),
    ("Finance & Accounts", "Payroll and budgeting"),
    ("Academic Registry", "Student records and admissions"),
    ("Security & Estates", "Campus security and facilities"),
]

SHIFTS = [
    # name, start, end, grace, working_days(JSON or None)
    ("Morning Shift", time(8, 0), time(16, 0), 30, None),
    ("Afternoon Shift", time(12, 0), time(20, 0), 30, None),
    ("Security Night", time(20, 0), time(6, 0), 30, "[0,1,2,3,4,5,6]"),  # 7 days
]

HOLIDAYS_2026 = [
    ("2026-10-01", "Independence Day"),
    ("2026-12-25", "Christmas Day"),
    ("2026-12-26", "Boxing Day"),
]


def clear_demo():
    """Wipe tables in FK-safe order (demo reset)."""
    AuditLog.query.delete()
    LeaveRequest.query.delete()
    Attendance.query.delete()
    BiometricTemplate.query.delete()
    User.query.filter(User.role == "staff").delete()
    Staff.query.delete()
    Holiday.query.delete()
    Shift.query.delete()
    Department.query.delete()
    db.session.commit()
    print("Cleared existing demo data.")


def run(fresh=False):
    app = create_app()
    with app.app_context():
        if fresh:
            clear_demo()

        # ---- Working days setting (Mon–Fri) ----
        Setting.put("working_days", [0, 1, 2, 3, 4])

        # ---- Admin ----
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", is_active=True)
            admin.set_password("admin123")
            db.session.add(admin)

        # ---- Departments ----
        dept_objs = []
        for name, desc in DEPARTMENTS:
            d = Department.query.filter_by(name=name).first()
            if not d:
                d = Department(name=name, description=desc)
                db.session.add(d)
            dept_objs.append(d)
        db.session.flush()

        # ---- Shifts ----
        shift_objs = []
        for name, start, end, grace, wd in SHIFTS:
            s = Shift.query.filter_by(shift_name=name).first()
            if not s:
                s = Shift(shift_name=name, start_time=start, end_time=end,
                          grace_period_minutes=grace, working_days=wd)
                db.session.add(s)
            shift_objs.append(s)
        db.session.flush()

        # ---- Holidays ----
        for d_str, name in HOLIDAYS_2026:
            d = datetime.strptime(d_str, "%Y-%m-%d").date()
            if not Holiday.query.filter_by(date=d).first():
                db.session.add(Holiday(date=d, name=name))
        db.session.flush()

        # ---- Staff + logins + fake fingerprints ----
        staff_objs = []
        first_staff_login = None
        for i, full_name in enumerate(NIGERIAN_NAMES):
            num = f"GVU/2026/{str(i + 1).zfill(3)}"
            if Staff.query.filter_by(staff_number=num).first():
                staff_objs.append(Staff.query.filter_by(staff_number=num).first())
                continue
            dept = dept_objs[i % len(dept_objs)]
            shift = shift_objs[i % len(shift_objs)]
            email = full_name.lower().replace(" ", ".") + "@gvu.edu"
            s = Staff(staff_number=num, full_name=full_name, email=email,
                      phone=f"0803{random.randint(1000000, 9999999)}",
                      gender=random.choice(["Male", "Female"]),
                      department_id=dept.department_id, shift_id=shift.shift_id,
                      designation=random.choice(["Officer", "Assistant", "Senior Officer", "Analyst"]),
                      status="Active", date_registered=datetime.utcnow())
            db.session.add(s)
            db.session.flush()
            staff_objs.append(s)

            # FAKE fingerprint placeholder (never real biometric data).
            db.session.add(BiometricTemplate(
                staff_id=s.staff_id, finger_type="Right Index",
                template_data=encrypt_bytes(f"DEMO_FP_{num}".encode()),
                quality_score=random.randint(80, 99), date_enrolled=datetime.utcnow()))

            # Staff login
            username = email.split("@")[0]
            u = User(username=username, role="staff", staff_id=s.staff_id, is_active=True)
            u.set_password("staff123")
            db.session.add(u)
            if first_staff_login is None:
                first_staff_login = username
        db.session.commit()

        # ---- Leave requests (pending / approved / rejected) ----
        today = date_cls.today()
        if LeaveRequest.query.count() == 0:
            samples = [
                (staff_objs[3], "approved", today - timedelta(days=5), today - timedelta(days=3)),
                (staff_objs[7], "pending", today + timedelta(days=2), today + timedelta(days=4)),
                (staff_objs[10], "rejected", today - timedelta(days=10), today - timedelta(days=9)),
            ]
            for s, status, sd, ed in samples:
                db.session.add(LeaveRequest(staff_id=s.staff_id, leave_type="Annual",
                                            start_date=sd, end_date=ed, reason=f"{DEMO_TAG} sample",
                                            status=status))
            db.session.commit()

        # ---- Attendance: last ~6 weeks ----
        if Attendance.query.count() == 0:
            approved_leave = {(lr.staff_id, d) for lr in LeaveRequest.query.filter_by(status="approved").all()
                              for d in _date_range(lr.start_date, lr.end_date)}
            for back in range(42, 0, -1):
                day = today - timedelta(days=back)
                for s in staff_objs:
                    if not is_working_day(day, s.shift):
                        continue
                    if (s.staff_id, day) in approved_leave:
                        continue
                    roll = random.random()
                    if roll < 0.08:
                        # absent
                        db.session.add(Attendance(staff_id=s.staff_id, date=day, status="Absent",
                                                  verification_method="Auto"))
                    elif roll < 0.12:
                        # incomplete (in, no out)
                        db.session.add(Attendance(staff_id=s.staff_id, date=day,
                                                  time_in=time(7, random.randint(45, 59)),
                                                  status="Incomplete", verification_method="Fingerprint"))
                    else:
                        late = roll < 0.25
                        tin = time(8, random.randint(31, 55)) if late else time(7, random.randint(40, 59))
                        # some overtime (later clock-out)
                        tout = time(random.choice([16, 17, 18]), random.randint(0, 59))
                        db.session.add(Attendance(
                            staff_id=s.staff_id, date=day, time_in=tin, time_out=tout,
                            status="Late" if late else "Present", verification_method="Fingerprint"))
            db.session.commit()

        # ---- Sample audit entries ----
        if AuditLog.query.count() == 0:
            for action, details in [
                ("LOGIN", "Administrator logged in"),
                ("IMPORT_STAFF", f"{DEMO_TAG} imported staff batch"),
                ("ABSENT_JOB_RUN", f"{DEMO_TAG} absent job executed"),
            ]:
                db.session.add(AuditLog(user_id=admin.user_id, action=action,
                                        table_affected="users", details=details,
                                        ip_address="127.0.0.1"))
            db.session.commit()

        print("\n✅ Demo seed complete.")
        print("   Admin login:  admin / admin123")
        print(f"   Staff login:  {first_staff_login or 'a.mensah'} / staff123")
        print(f"   Staff: {len(staff_objs)} | Departments: {len(dept_objs)} | Shifts: {len(shift_objs)}")
        print(f"   All demo leave/audit rows tagged with {DEMO_TAG} for easy removal.")


def _date_range(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


if __name__ == "__main__":
    run(fresh="--fresh" in sys.argv)
