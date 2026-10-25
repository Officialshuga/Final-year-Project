# GVU Biometric Staff Attendance — Backend API

Flask + MySQL REST API for the Biometric Staff Attendance Management System.

> **Build status: COMPLETE.** All modules implemented —
> auth, departments, shifts, staff, users & roles, biometric enrolment,
> attendance scan/records, dashboards, reports (PDF/Excel) and audit logs.
> See **API.md** for the full endpoint reference and **FRONTEND_INTEGRATION.md**
> for connecting the React app.

---

## 1. Project structure

```
backend/
├── wsgi.py                     # entry point (flask / gunicorn)
├── config.py                   # all settings from .env (no hard-coded secrets)
├── seed.py                     # seed admin + sample departments/shifts/staff
├── requirements.txt
├── .env.example                # copy to .env and fill in
├── app/
│   ├── __init__.py             # application factory + middleware + error handlers
│   ├── extensions.py           # db, migrate, jwt, cors, limiter objects
│   ├── models/                 # SQLAlchemy models (the 7 tables)
│   │   ├── __init__.py
│   │   ├── department.py
│   │   ├── shift.py
│   │   ├── staff.py
│   │   ├── biometric_template.py
│   │   ├── attendance.py
│   │   ├── user.py
│   │   └── audit_log.py
│   ├── utils/
│   │   ├── crypto.py           # AES/Fernet encryption for biometric templates
│   │   ├── security.py         # RBAC decorators + ownership checks
│   │   └── audit.py            # audit-log helper
│   └── auth/
│       ├── __init__.py
│       └── routes.py           # login, logout, refresh, change/forgot/reset pw
└── migrations/                 # created by `flask db init` (Alembic)
```

Feature modules (all implemented, auto-registered by the app factory):
`app/staff`, `app/departments`, `app/shifts`, `app/users`, `app/biometrics`,
`app/attendance`, `app/dashboard`, `app/reports`, `app/audit`.

### Run the tests (no MySQL needed — uses in-memory SQLite)
```bash
cd backend
FLASK_ENV=testing pytest -q
```
Covers: valid scan, unknown fingerprint, duplicate sign-in, late arrival,
staff blocked from another staff member's data, and admin-only routes.

---

## 2. Setup

### Prerequisites
- Python 3.11+
- MySQL 8+ running locally

### Create the database (MySQL shell)
```sql
CREATE DATABASE gvu_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gvu_user'@'localhost' IDENTIFIED BY 'gvu_password';
GRANT ALL PRIVILEGES ON gvu_attendance.* TO 'gvu_user'@'localhost';
FLUSH PRIVILEGES;
```

### Install + configure
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set DATABASE_URL, SECRET_KEY, JWT_SECRET_KEY
# Generate a biometric encryption key and paste it into BIOMETRIC_ENC_KEY:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Migrations (creates the 7 tables)
```bash
flask --app wsgi db init         # first time only (creates migrations/)
flask --app wsgi db migrate -m "initial schema"
flask --app wsgi db upgrade
```

### Seed starter data
```bash
python seed.py
# Admin login:  admin / admin123
# Staff logins: a.mensah / staff123 (and others)
```

### Run
```bash
flask --app wsgi run --port 8000
# or: python wsgi.py
# Health check: http://localhost:8000/api/health
# Swagger docs (added with API module): http://localhost:8000/docs
```

---

## 3. Auth endpoints (Module 1)

| Method | URL                        | Role        | Body                                   |
|--------|----------------------------|-------------|----------------------------------------|
| POST   | /api/auth/login            | public      | `{username, password}`                 |
| POST   | /api/auth/refresh          | refresh JWT | — (send refresh token as Bearer)       |
| POST   | /api/auth/logout           | any         | — (send access token as Bearer)        |
| GET    | /api/auth/me               | any         | —                                      |
| POST   | /api/auth/change-password  | any         | `{current_password, new_password}`     |
| POST   | /api/auth/forgot-password  | public      | `{username}`                           |
| POST   | /api/auth/reset-password   | public      | `{reset_token, new_password}`          |

### Example: login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
```json
{
  "user": {"user_id":1,"username":"admin","role":"admin","staff_id":null,"is_active":true,"last_login":"...","locked":false},
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

Use the token on protected routes:
```bash
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer <access_token>"
```

---

## 4. Security built into Module 1
- **bcrypt** password hashing
- **JWT** access + refresh tokens with role & staff_id claims
- **Rate limiting** on `/login` (Flask-Limiter)
- **Account lockout** after N failed attempts (configurable)
- **RBAC decorators** (`@admin_required`, `@roles_required`) + ownership checks
  (`ensure_self_or_admin`) so staff can't read others' data by changing an ID
- **AES/Fernet** encryption helper for biometric templates
- **CORS** limited to the frontend origin(s) from `.env`
- **Audit logging** of login / failed login / lockout / logout and all
  state-changing requests via middleware

### HTTPS notes (production)
- Terminate TLS at nginx/Caddy or a load balancer; run gunicorn behind it.
- Set `FLASK_ENV=production`, strong `SECRET_KEY`/`JWT_SECRET_KEY`.
- Use a Redis store for rate limiting and the JWT blocklist across workers.
```
