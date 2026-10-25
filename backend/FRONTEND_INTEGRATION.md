# Connecting the React frontend to this backend

The frontend currently uses mock data from `src/data/mockDatabase.ts`.
To use the real API, replace those imports with HTTP calls. Here's the plan.

## 1. Start the backend
```bash
cd backend
source venv/bin/activate
flask --app wsgi run --port 8000
```
It runs at `http://localhost:8000`. CORS already allows `http://localhost:5173`
(the Vite dev server) — change `FRONTEND_ORIGINS` in `.env` if your URL differs.

## 2. Add an API base URL to the frontend
Create `.env` in the project root (next to package.json):
```
VITE_API_URL=http://localhost:8000/api
```

## 3. Create a tiny API helper (frontend)
Create `src/api/client.ts`:
```ts
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function token() { return localStorage.getItem("gvu_token") || ""; }

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json()).message || res.statusText);
  return res.json();
}
```

## 4. Wire login (replace the mock check in LoginPage/App)
```ts
import { api } from "./api/client";

async function handleLogin(username: string, password: string) {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("gvu_token", data.access_token);
  localStorage.setItem("gvu_refresh", data.refresh_token);
  // data.user.role is "admin" | "staff"
  setSession({ username: data.user.username, role: data.user.role === "admin" ? "Admin" : "Staff" });
}
```

## 5. Replace each page's mock data with API calls
Map each `TODO(API)` in the frontend to an endpoint:

| Frontend page | Replace mock with |
|---------------|-------------------|
| Dashboard (admin) | `GET /dashboard/admin` |
| Dashboard (staff) | `GET /dashboard/me` |
| Staff Management | `GET/POST/PUT/DELETE /staff`, `PATCH /staff/:id/status` |
| Departments | `GET/POST/PUT/DELETE /departments` |
| Shifts | `GET/POST/PUT/DELETE /shifts` |
| Users & Roles | `GET/POST /users`, `PATCH /users/:id/role|status`, `DELETE /users/:id` |
| Biometric Enrolment | `POST /biometrics/enroll`, `GET /biometrics/staff/:id`, `DELETE /biometrics/:id` |
| Attendance Terminal | `POST /attendance/scan` with `{template}` |
| Attendance Records | `GET /attendance?...filters` |
| Reports | `GET /reports/admin` or `/reports/me`; exports `/reports/export/pdf|excel` |
| Audit Logs | `GET /audit?...filters` |
| Profile (staff) | `GET /auth/me`, `POST /auth/change-password` |

Example (Staff Management list):
```ts
const { staff, pagination } = await api(`/staff?search=${q}&page=${page}`);
```

Example (enrolment — the kiosk/reader produces a `template` string):
```ts
await api("/biometrics/enroll", {
  method: "POST",
  body: JSON.stringify({ staff_id, finger_type: "Right Index", template, quality_score: 95 }),
});
```

Example (attendance kiosk scan):
```ts
const result = await api("/attendance/scan", {
  method: "POST",
  body: JSON.stringify({ template }),  // from fingerprint reader
});
// result.action = "check_in" | "check_out" | "duplicate"
// result.staff_name, result.status, result.time
```

## 6. Token refresh (optional but recommended)
When a request returns 401, call `POST /auth/refresh` with the refresh token as
Bearer, store the new `access_token`, and retry the original request.

## 7. Biometric templates — where do they come from?
- **With real hardware:** the ZKTeco/SecuGen SDK runs on the kiosk machine and
  produces a template string/blob. Send that string as `template`.
- **Without hardware (testing):** send any consistent string per finger. The
  simulated adapter matches identical strings, so enrol `"alice-right-index"`
  and scan the same string to identify Alice. Set `BIOMETRIC_ADAPTER=simulated`.

## 8. Production checklist
- Serve behind HTTPS (nginx/Caddy), set `FLASK_ENV=production`.
- Strong `SECRET_KEY`, `JWT_SECRET_KEY`; keep `BIOMETRIC_ENC_KEY` safe (losing it
  makes stored templates unreadable).
- Use Redis for rate-limit + JWT blocklist across multiple workers.
- Point `FRONTEND_ORIGINS` at your deployed frontend URL.
```
