# GVU Fingerprint Local Bridge Service

A browser (the React kiosk) **cannot talk to a USB fingerprint sensor directly**
for security reasons. So we run a tiny **local bridge service** on the scan
station PC. It uses the manufacturer's SDK to drive the sensor, and exposes a
small HTTP API that only the kiosk page (on the same PC) can call.

## The flow (text diagram)

```
  SCAN STATION PC (physically has the USB sensor)          SERVER (anywhere)
 ┌───────────────────────────────────────────────┐      ┌───────────────────┐
 │                                                │      │                   │
 │  React Kiosk page (browser)                    │      │  Flask backend    │
 │        │  1. "capture fingerprint"            │      │  (your API)       │
 │        ▼  http://localhost:5050/capture        │      │                   │
 │  Local Bridge Service (this folder)            │      │                   │
 │        │  2. uses ZKTeco/SecuGen SDK           │      │                   │
 │        ▼                                        │      │                   │
 │  USB Fingerprint Sensor                         │      │                   │
 │        │  3. returns {template, quality}        │      │                   │
 │        ▼                                        │      │                   │
 │  React Kiosk receives template ────────────────┼─ 4 ─▶│  /api/biometrics  │
 │                                                │ HTTPS │  /enroll   (save) │
 │                                                │      │  /attendance/scan │
 │                                                │      │  (1:N match)      │
 └───────────────────────────────────────────────┘      └───────────────────┘
```

### Which part runs where
| Part | Runs on | Purpose |
|------|---------|---------|
| USB sensor | Scan station PC | Captures the physical fingerprint |
| **Bridge service** (this folder) | Scan station PC | Talks to the sensor via the SDK; HTTP on `localhost` only |
| React kiosk page | Scan station PC browser | Calls the bridge, then sends the template to the backend |
| Flask backend | Server (can be elsewhere) | Encrypts/stores templates, does 1:N matching, records attendance |

**Key idea:** the bridge only *captures* a template and returns it. All the
important logic (encryption, matching, attendance rules, audit) stays in the
Flask backend you already built — nothing there is rewritten.

## Run it
```
cd bridge
python -m venv venv && venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env                              # then edit BRIDGE_TOKEN
python bridge.py
```
The bridge listens on `http://127.0.0.1:5050` (localhost only).
