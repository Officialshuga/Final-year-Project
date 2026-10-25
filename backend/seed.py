# ============================================================================
# FILE: seed.py
# PURPOSE: Populate the database with starter data:
#   - one admin account (username: admin)
#   - sample departments, shifts
#   - a few sample staff, each with a linked staff login
#
# RUN:  python seed.py
# (Make sure you've run migrations first: `flask --app wsgi db upgrade`)
#
# Idempotent: running it again won't create duplicates.
# ============================================================================
from datetime import time, datetime

from app import create_app
from app.extensions import db
from app.models import Department, Shift, Staff, User


def get_or_create(model, defaults=None, **kwargs):
    """Return an existing row matching kwargs, or create it."""
    instance = model.query.filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    db.session.add(instance)
    db.session.flush()  # assign PK without full commit
    return instance, True


def run():
    app = create_app()
    with app.app_context():
        # ---------------- Admin account ----------------
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", is_active=True)
            admin.set_password("admin123")  # CHANGE after first login!
            db.session.add(admin)
            print("Created admin account (admin / admin123)")
        else:
            print("Admin already exists — skipping")

        # ---------------- Departments ----------------
        departments = [
            ("Information & Communication Tech", "Handles all ICT infrastructure"),
            ("Human Resources", "Staff welfare and recruitment"),
            ("Finance & Accounts", "Payroll and budgeting"),
            ("Academic Registry", "Student records and admissions"),
            ("Library Services", "Library and learning resources"),
            ("Security & Estates", "Campus security and facilities"),
        ]
        dept_objs = {}
        for name, desc in departments:
            obj, created = get_or_create(Department, name=name, defaults={"description": desc})
            dept_objs[name] = obj
            if created:
                print(f"Created department: {name}")

        # ---------------- Shifts ----------------
        shifts = [
            ("Morning Shift", time(8, 0), time(16, 0), 30),
            ("Afternoon Shift", time(12, 0), time(20, 0), 30),
            ("Security Night", time(20, 0), time(6, 0), 30),
            ("Library Extended", time(9, 0), time(18, 0), 30),
        ]
        shift_objs = {}
        for name, start, end, grace in shifts:
            obj, created = get_or_create(
                Shift, shift_name=name,
                defaults={"start_time": start, "end_time": end, "grace_period_minutes": grace},
            )
            shift_objs[name] = obj
            if created:
                print(f"Created shift: {name}")

        # ---------------- Sample staff (+ their login) ----------------
        sample_staff = [
            # staff_number, full_name, email, phone, gender, dept, shift, designation, username
            ("GVU/2022/001", "Adaeze Mensah", "a.mensah@gvu.edu", "08031112201", "Female",
             "Information & Communication Tech", "Morning Shift", "Head of ICT", "a.mensah"),
            ("GVU/2022/004", "Samuel Okafor", "s.okafor@gvu.edu", "08031112204", "Male",
             "Human Resources", "Morning Shift", "HR Officer", "s.okafor"),
            ("GVU/2023/010", "Joy Adeyemi", "j.adeyemi@gvu.edu", "08031112210", "Female",
             "Finance & Accounts", "Morning Shift", "Accountant", "j.adeyemi"),
        ]
        for num, name, email, phone, gender, dept, shift, title, username in sample_staff:
            existing = Staff.query.filter_by(staff_number=num).first()
            if existing:
                print(f"Staff {num} already exists — skipping")
                continue
            s = Staff(
                staff_number=num, full_name=name, email=email, phone=phone, gender=gender,
                department_id=dept_objs[dept].department_id,
                shift_id=shift_objs[shift].shift_id,
                designation=title, status="Active", date_registered=datetime.utcnow(),
            )
            db.session.add(s)
            db.session.flush()  # get s.staff_id

            # Create their login account (role = staff). Default password.
            u = User(username=username, role="staff", staff_id=s.staff_id, is_active=True)
            u.set_password("staff123")
            db.session.add(u)
            print(f"Created staff + login: {name} ({username} / staff123)")

        db.session.commit()
        print("\n✅ Seed complete.")
        print("   Admin login:  admin / admin123")
        print("   Staff logins: a.mensah / staff123  (and others)")


if __name__ == "__main__":
    run()
