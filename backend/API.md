# GVU Attendance API — Endpoint Reference

Base URL: `http://localhost:8000/api`
Auth: send `Authorization: Bearer <access_token>` on protected routes.
Interactive docs (Swagger UI): `http://localhost:8000/docs` *(when flask-smorest spec is enabled)*

Roles: **public** (no token), **any** (admin or staff), **admin**, **staff**.
Ownership: staff endpoints only ever return/modify the caller's own data.

---

## Auth
| Method | URL | Role | Body | Returns |
|--------|-----|------|------|---------|
| POST | /auth/login | public | `{username, password}` | user + access_token + refresh_token |
| POST | /auth/refresh | refresh token | — | `{access_token}` |
| POST | /auth/logout | any | — | message |
| GET | /auth/me | any | — | `{user}` |
| POST | /auth/change-password | any | `{current_password, new_password}` | message |
| POST | /auth/forgot-password | public | `{username}` | reset_token (demo) |
| POST | /auth/reset-password | public | `{reset_token, new_password}` | message |

## Dashboard
| Method | URL | Role | Returns |
|--------|-----|------|---------|
| GET | /dashboard/admin | admin | cards, weekly_trend, department_breakdown, recent_activity |
| GET | /dashboard/me | staff | staff, today, cards, weekly_trend, recent |

## Staff (admin)
| Method | URL | Role | Notes |
|--------|-----|------|-------|
| GET | /staff?search=&department_id=&status=&page=&per_page= | admin | paginated |
| GET | /staff/:id | admin | |
| POST | /staff | admin | also creates login user; returns temp password |
| PUT | /staff/:id | admin | |
| PATCH | /staff/:id/status | admin | `{status: Active|Inactive}` |
| DELETE | /staff/:id | admin | cascades biometrics/attendance/login |

## Departments (admin)
| Method | URL | Body |
|--------|-----|------|
| GET | /departments | — |
| POST | /departments | `{name, description}` |
| PUT | /departments/:id | `{name?, description?}` |
| DELETE | /departments/:id | blocked if staff assigned |

## Shifts (admin)
| Method | URL | Body |
|--------|-----|------|
| GET | /shifts | — |
| POST | /shifts | `{shift_name, start_time, end_time, grace_period_minutes}` |
| PUT | /shifts/:id | partial |
| DELETE | /shifts/:id | blocked if staff assigned |

## Users & Roles (admin)
| Method | URL | Body |
|--------|-----|------|
| GET | /users?role= | — |
| POST | /users | `{username, password, role, staff_id?}` |
| PATCH | /users/:id/role | `{role}` |
| PATCH | /users/:id/reset-password | `{new_password}` |
| PATCH | /users/:id/status | `{is_active}` |
| DELETE | /users/:id | cannot delete self |

## Biometrics
| Method | URL | Role | Notes |
|--------|-----|------|-------|
| GET | /biometrics/staff/:id | any (own/admin) | lists fingers; never returns raw template |
| POST | /biometrics/enroll | any (own/admin) | `{staff_id, finger_type, template, quality_score?}` |
| DELETE | /biometrics/:template_id | any (own/admin) | |

## Attendance
| Method | URL | Role | Notes |
|--------|-----|------|-------|
| POST | /attendance/scan | any | `{template}` → identify + clock in/out |
| GET | /attendance?from=&to=&department_id=&status=&staff_id= | any | admin=all, staff=own |
| GET | /attendance/staff/:id | any (own/admin) | |

### `POST /attendance/scan` responses
- **200 check_in**: `{action:"check_in", staff_name, status:"Present"|"Late", time, match_score}`
- **200 check_out**: `{action:"check_out", staff_name, time, hours_worked}`
- **409 duplicate**: already clocked in and out today
- **404 NoMatch**: fingerprint not recognised

## Reports
| Method | URL | Role | Notes |
|--------|-----|------|-------|
| GET | /reports/admin?period=daily|weekly|monthly | admin | confidential org-wide |
| GET | /reports/me?period= | staff | personal |
| GET | /reports/export/excel?from=&to=&staff_id= | any | admin=all, staff=own |
| GET | /reports/export/pdf?from=&to=&staff_id= | any | admin=all, staff=own |

## Audit logs
| Method | URL | Role | Notes |
|--------|-----|------|-------|
| GET | /audit?action=&user_id=&from=&to=&search= | any | admin=all, staff=own |

---

### Example: full admin flow with curl
```bash
# 1. login
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. create a department
curl -X POST localhost:8000/api/departments -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Student Affairs"}'

# 3. create a staff member (auto-creates login)
curl -X POST localhost:8000/api/staff -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"staff_number":"GVU/2026/050","full_name":"Mary Johnson","email":"mary@gvu.edu"}'
```
