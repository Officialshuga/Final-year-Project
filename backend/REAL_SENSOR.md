# Connecting a REAL Fingerprint Sensor

Sensor assumed: **ZKTeco (ZK9500/SLK20R), Python `pyzkfp` SDK, Windows scan station**
(SecuGen adapters are stubbed in the same files — swap the SDK calls).

Nothing in the existing system was rewritten. These are the **added** pieces.

## What was added
| File | Runs on | Purpose |
|------|---------|---------|
| `bridge/bridge.py`, `bridge/sensors.py` | Scan station | Local HTTP bridge → talks to the USB sensor |
| `bridge/autostart.md` | Scan station | Start bridge on boot |
| `src/api/fingerprintBridge.ts` | Kiosk browser | Calls the bridge (status/capture/cancel) |
| `app/biometrics/real_adapter.py` | Server | Real matching adapter (same interface) |
| `app/biometrics/template_cache.py` | Server | In-memory decrypted-template cache (speed) |
| `/api/attendance/manual` | Server | Manual fallback when the sensor is down |
| multi-sample enrol (`samples[]`) | Server | 2–3 captures merged, low quality rejected |

## Flow
```
Kiosk browser → http://127.0.0.1:5050 (bridge, token-protected)
  → ZKTeco SDK → USB sensor → {template, quality}
Kiosk → HTTPS → Flask /api/biometrics/enroll  (enrol)  or
                /api/attendance/scan           (1:N match → clock in/out)
```
- **Scan station:** USB sensor + bridge + kiosk page.
- **Server:** Flask backend (encrypt/store, match, attendance rules, audit).

## Switch simulated ↔ real
Backend `.env`: `BIOMETRIC_ADAPTER=zkteco` (or `simulated`). One line, no code change.

## Wiring the kiosk capture (frontend, when connected)
```ts
import { bridgeStatus, bridgeCapture } from "../api/fingerprintBridge";

// On load: check sensor
const st = await bridgeStatus();      // {connected, sensor, message}
// On "scan":
try {
  const { template, quality } = await bridgeCapture();   // from the sensor
  // send to backend (replaces the simulated template):
  await api("/attendance/scan", { method: "POST", body: JSON.stringify({ template }) });
} catch (e) {
  // e.message is a clear status: NO_DEVICE / NO_FINGER / LOW_QUALITY / TIMEOUT
}
```
Enrolment (multi-sample):
```ts
const samples = [];
for (let i = 0; i < 3; i++) samples.push(await bridgeCapture()); // 3 presses
await api("/biometrics/enroll", { method: "POST",
  body: JSON.stringify({ staff_id, finger_type: "Right Index", samples }) });
```
On devices with **no sensor**, `bridgeStatus()` returns `connected:false` →
show "Enrolment requires the scan station" and offer the manual fallback (admin).

## Security recap
- Encryption key stays in backend `.env` (`BIOMETRIC_ENC_KEY`). Templates AES/Fernet-encrypted.
- Raw templates never logged or returned; decrypted only in memory for matching.
- Bridge: localhost-only bind + `X-Bridge-Token` shared secret + CORS to kiosk origin.
- Use HTTPS between kiosk and backend in production.

## Test results (Section 8)

Run: `cd backend && FLASK_ENV=testing pytest -q` → **38 passed**

| Test case | Expected result | Actual result |
|-----------|-----------------|---------------|
| Successful enrollment (multi-sample) | 201, template stored, raw never returned | ✅ Pass |
| Poor-quality scan | 422 LowQuality, asks to retry | ✅ Pass |
| Unplugged sensor | Bridge returns NO_DEVICE; kiosk shows message; manual fallback available | ✅ Pass (bridge `/status`,`/capture` return NO_DEVICE 503) |
| Correct match | Identifies the right staff, clock-in recorded | ✅ Pass |
| Wrong finger | 404 NoMatch (not recognised) | ✅ Pass |
| Duplicate scan | 409 after in+out | ✅ Pass |
| Matching speed, 300+ staff | Fast via in-memory cache (<3s) | ✅ Pass |
| Manual fallback requires reason | 400 without reason; 200 with reason (admin only) | ✅ Pass |
| Switch back to simulated adapter | `simulated` selected; exact match=100 | ✅ Pass |

> "Unplugged sensor" at the hardware level is validated through the bridge
> endpoints (they return `NO_DEVICE`); the server-side suite covers the API
> behaviour that depends on it (manual fallback, clear errors).
