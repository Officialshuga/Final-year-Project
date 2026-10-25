# Attendance Automation — Server Time, Absent Job, Working Days, Import, Seed

Tech stack: **React + TypeScript (frontend)** / **Flask + Python (backend)** / **MySQL (database)**

Covers sections 1–5 plus the test table.

---

## 1. Server-side time
- `GET /api/system/time` returns the authoritative server time (UTC + Africa/Lagos + `epoch_ms`).
- `POST /api/attendance/scan` **ignores** any `time`/`timestamp` sent by the client and stamps the record from the **server clock** (`app/utils/clock.py`).
- Timestamps are handled in **UTC** and converted to **Africa/Lagos** for display.
- The kiosk (`AttendanceTerminal.tsx`) fetches `/system/time` on load and every 5 minutes, computes the offset vs the device clock, and ticks using the **server** time — so changing the device/phone/scanner clock has no effect.

## 2. Automatic absent marking
- Core logic: `app/absent_job/job.py` → `mark_absentees_for_date(date)`.
- Cron runner: `run_absent_job.py` (defaults to yesterday).
  ```
  30 23 * * *  cd /path/backend && venv/bin/python run_absent_job.py
  ```
- Manual admin trigger: `POST /api/absent-job/run` `{ "date": "YYYY-MM-DD" }`.
- Rules: only active staff, on a working day, with no scan and no approved leave,
  and not a holiday → creates an **Absent** row. Missing clock-out → **Incomplete**.
- **Night shifts** (start > end) are attributed to the day the shift started.
- **Idempotent**: unique `(staff_id, date)` + existence check → safe to run twice.
- Each run writes an **audit log** entry with the counts.

## 3. Working days & holidays
- `GET/PUT /api/settings/working-days` → weekday set (Mon=0..Sun=6); default Mon–Fri.
- Per-shift override via `shifts.working_days` (e.g. night security = all 7 days).
- Holidays CRUD: `GET/POST/PUT/DELETE /api/settings/holidays`.
- Shared rules in `app/utils/calendar_rules.py` used by the absent job AND the
  calendar/reports, so non-working days/holidays are **never** marked absent.
- `GET /api/attendance/calendar?month=YYYY-MM&staff_id=` returns each day marked
  `working | non-working | holiday` + the staff status, for the attendance calendar.

## 4. Bulk staff import
- `GET /api/imports/template` → downloadable CSV template
  (columns: staff_id, full_name, email, phone, department, shift).
- `POST /api/imports/preview` → validates every row, returns valid rows + error
  rows with reasons (no save). Checks required fields, duplicate IDs (in file and
  DB), email format, and that department/shift names exist.
- `POST /api/imports/commit` → saves only valid rows, creates a login per staff
  with a **random temp password** + `must_change_password`, and returns the temp
  passwords **once** (hashed with bcrypt; plain never stored).
- File type limited to `.csv`/`.xlsx`, size ≤ 2 MB. Import is audit-logged.

## 5. Seed data
- `python seed_demo.py` (add `--fresh` to wipe demo data first — re-run safe).
- 1 admin, ~25 staff (Nigerian names), 5 departments, 3 shifts (incl. night),
  holidays, ~6 weeks of attendance (on-time / late / absent / leave / overtime /
  incomplete), leave requests (pending/approved/rejected), sample audit logs.
- Fingerprints are **fake placeholders** (`DEMO_FP_*`), never real biometrics.
- Prints the admin + one staff login at the end. Demo rows tagged `[DEMO]`.

---

## Test results

Run: `cd backend && FLASK_ENV=testing pytest -q` → **29 passed**

| Test case | Expected result | Actual result |
|-----------|-----------------|---------------|
| Device clock changed on scan | Recorded time uses server clock, not device value | ✅ Pass |
| Server time endpoint | Returns Africa/Lagos + epoch_ms | ✅ Pass |
| Absent job run twice | Second run creates 0 duplicates | ✅ Pass |
| Holiday | Nobody marked absent on a holiday | ✅ Pass |
| Non-working day (Sunday) | Nobody marked absent | ✅ Pass |
| Missing clock-out | Record flagged "Incomplete" | ✅ Pass |
| Night shift (20:00–06:00) | `crosses_midnight` true; attributed to start day | ✅ Pass |
| CSV with errors | Bad rows flagged with reasons, valid rows importable | ✅ Pass |
| Import commit | Logins created with temp password + must-change flag | ✅ Pass |
| Staff tries import endpoint | 403 Forbidden (admin only) | ✅ Pass |
| Seed/settings re-run | Upsert works, no duplicates/crash | ✅ Pass |

Migration after pulling these changes:
```bash
flask --app wsgi db migrate -m "settings, holidays, leave, night shift, import"
flask --app wsgi db upgrade
python seed_demo.py --fresh
```
