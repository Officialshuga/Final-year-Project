// ============================================================================
// FILE: src/api/fingerprintBridge.ts
// PURPOSE: Tiny client the kiosk/enrolment pages use to talk to the LOCAL
//          fingerprint bridge running on the scan-station PC.
// ----------------------------------------------------------------------------
// The bridge runs at http://127.0.0.1:5050 and needs a shared token. We keep
// the token in a Vite env var on the scan station only.
//
// If the bridge is unreachable (no sensor / not a scan station), callers should
// fall back to the simulated flow or show a "no sensor" message.
// ============================================================================

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || "http://127.0.0.1:5050";
const BRIDGE_TOKEN = import.meta.env.VITE_BRIDGE_TOKEN || "";

export interface CaptureResult {
  template: string;   // base64 template from the sensor
  quality: number;    // 0..100
}

export interface BridgeStatus {
  connected: boolean;
  sensor: string;
  error?: string;
  message?: string;
}

function headers() {
  return { "Content-Type": "application/json", "X-Bridge-Token": BRIDGE_TOKEN };
}

/** Is the sensor plugged in and ready? Never throws — returns connected:false. */
export async function bridgeStatus(): Promise<BridgeStatus> {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, { headers: headers() });
    if (!res.ok) return { connected: false, sensor: "unknown", message: "Bridge error" };
    return (await res.json()) as BridgeStatus;
  } catch {
    // Bridge not running / not a scan station.
    return { connected: false, sensor: "none", error: "NO_BRIDGE",
             message: "Fingerprint bridge not reachable on this PC." };
  }
}

/** Capture one fingerprint. Throws an Error with a clear .message on failure. */
export async function bridgeCapture(): Promise<CaptureResult> {
  const res = await fetch(`${BRIDGE_URL}/capture`, { method: "POST", headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Bubble up the specific error (NO_DEVICE / NO_FINGER / LOW_QUALITY / TIMEOUT)
    throw new Error(data.message || "Fingerprint capture failed");
  }
  return data as CaptureResult;
}

/** Cancel an in-progress capture (best effort). */
export async function bridgeCancel(): Promise<void> {
  try {
    await fetch(`${BRIDGE_URL}/cancel`, { method: "POST", headers: headers() });
  } catch {
    /* ignore */
  }
}

/** True if a bridge/sensor is available on this machine. */
export async function hasSensor(): Promise<boolean> {
  return (await bridgeStatus()).connected;
}
