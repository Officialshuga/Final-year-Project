# Password Reset — Design, API & Tests

Tech stack: **React + TypeScript (frontend)** / **Flask + Python (backend)** / **MySQL (database)**

This document covers the self-service password-reset feature (sections 1–7).

---

## 1. Login page (frontend)
- A **"Forgot password?"** link sits under the login form.
- It opens a modal with a **Staff ID** field and an optional **message** box.
- On submit it ALWAYS shows the same generic message:
  *"If this account exists, your request has been sent to the administrator."*
  This prevents attackers from discovering valid staff IDs.

## 2. Database — `password_reset_requests`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| staff_id | INT FK → staff | NULL if the submitted ID didn't match |
| submitted_identifier | VARCHAR | exactly what the user typed |
| message | VARCHAR(255) | optional |
| status | VARCHAR | `pending` / `completed` / `rejected` |
| requested_at | DATETIME | |
| ip_address | VARCHAR(45) | captured for audit |
| handled_by | INT FK → users | who actioned it |
| handled_at | DATETIME | when actioned |

## Endpoints
| Method | URL | Role | Notes |
|--------|-----|------|-------|
| POST | /api/password-requests | **public** | `{staff_id, message}` · rate-limited 5/hour/IP · ignores duplicates · generic response |
| GET | /api/password-requests?status= | admin | list + `pending_count` |
| PATCH | /api/password-requests/:id/reset | admin | resets account, returns temp password **once** |
| PATCH | /api/password-requests/:id/reject | admin | rejects |
| PATCH | /api/users/:id/reset-password | admin | **direct** reset (no request) — returns temp password once |
| POST | /api/auth/change-password | any | strong rules; clears `must_change_password` |
| POST | /api/auth/login | public | returns `must_change_password`; blocks expired temp passwords |

### Submit example
```bash
curl -X POST http://localhost:8000/api/password-requests \
  -H "Content-Type: application/json" \
  -d '{"staff_id":"GVU/2026/001","message":"Forgot my password"}'
# => 202 {"message":"If this account exists, your request has been sent to the administrator."}
```

## 4. Reset logic (admin clicks "Reset password")
1. Generates a random temp password (≥10 chars, upper+lower+digit+symbol).
2. Hashes it with **bcrypt** — the plain value is never stored.
3. Returns the plain temp password **once** (admin copies & hands over in person).
4. Sets `must_change_password = true` and a **24-hour expiry**.
5. Bumps `session_epoch`, which **invalidates all existing JWTs** for that user
   (forced logout of old sessions).
6. Marks the request `completed`, records `handled_by` + `handled_at`.

## 5. First login after reset
- Login with the temp password returns `must_change_password: true`.
- A server `before_request` guard blocks **every** API route except
  `change-password`, `logout`, `me`, `health` until the password is changed.
- New password must meet strength rules and must differ from the temp password.
- Temp passwords **expire after 24 hours** → login returns `403 Expired`.

## 6. Security & audit
- Only **admin** can list/reset/reject (enforced by `@admin_required`).
- Every submit, reset and rejection is written to `audit_logs` with the
  acting user, timestamp and IP address.
- Repeated failed logins still trigger the existing **account lockout**.
- Admin hands the temp password over **in person / trusted channel** (shown once).

---

## 7. Test results

Run: `cd backend && FLASK_ENV=testing pytest -q` → **18 passed**

| Test case | Expected result | Actual result |
|-----------|-----------------|---------------|
| Valid staff ID request | 202, request stored, generic message | ✅ Pass |
| Invalid staff ID | Same generic message (no enumeration) | ✅ Pass |
| Duplicate pending requests | Second ignored, only 1 pending row | ✅ Pass |
| Staff opens admin requests page | 403 Forbidden | ✅ Pass |
| Admin reset returns temp password | 200, temp ≥10 chars, 24h expiry | ✅ Pass |
| Forced change on first login | Blocked (403 PasswordChangeRequired) until changed | ✅ Pass |
| Expired temporary password | 403 Expired at login | ✅ Pass |
| Change password (strength enforced) | Weak rejected, strong accepted | ✅ Pass |
| Staff cannot read another staff's data | 403 Forbidden | ✅ Pass |
| Admin-only routes block staff | 403 Forbidden | ✅ Pass |

Migration after pulling these changes:
```bash
flask --app wsgi db migrate -m "password reset requests + forced change"
flask --app wsgi db upgrade
```
