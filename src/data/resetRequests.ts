// ============================================================================
// FILE: src/data/resetRequests.ts
// PURPOSE: Password-reset requests made from the login "Forgot password?" link.
// ----------------------------------------------------------------------------
// Frontend-only store (localStorage) that MIRRORS the backend table
// `password_reset_requests`:
//   id, staff_id, message, status, requested_at, handled_by, handled_at
//
// SECURITY (mirrors backend behaviour):
//   - Submitting ALWAYS returns the same generic message, so an attacker can't
//     tell which staff IDs are valid.
//   - Duplicate PENDING requests for the same staff ID are ignored.
//
// TODO(API): when linked to the backend, replace these helpers with:
//   POST  /api/password-requests                 (submit; no login required)
//   GET   /api/password-requests                 (admin: list)
//   PATCH /api/password-requests/:id/reset       (admin: reset -> temp password)
//   PATCH /api/password-requests/:id/reject      (admin: reject)
// ============================================================================

export type ResetStatus = "pending" | "completed" | "rejected";

export interface ResetRequest {
  id: number;
  staff_id: string;        // the staff ID / staff number the person typed
  message: string;         // optional short message
  // Display helpers (resolved from known data; "Unknown"/"—" if not found).
  full_name: string;
  department: string;
  status: ResetStatus;
  requested_at: string;    // "YYYY-MM-DD HH:MM"
  handled_by: string | null;
  handled_at: string | null;
}

const KEY = "gvu_reset_requests";

export function getResetRequests(): ResetRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResetRequest[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: ResetRequest[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/**
 * Submit a request.
 * Returns true if a NEW pending request was stored, false if it was ignored
 * (duplicate pending for the same staff ID). The CALLER must show the SAME
 * generic message regardless of the return value.
 */
export function addResetRequest(
  staff_id: string,
  message: string,
  resolved: { full_name: string; department: string }
): boolean {
  const list = getResetRequests();
  // Ignore duplicate pending requests from the same staff ID.
  const dup = list.find(
    (r) => r.staff_id.toLowerCase() === staff_id.toLowerCase() && r.status === "pending"
  );
  if (dup) return false;

  const entry: ResetRequest = {
    id: Date.now(),
    staff_id,
    message: message.trim(),
    full_name: resolved.full_name,
    department: resolved.department,
    status: "pending",
    requested_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    handled_by: null,
    handled_at: null,
  };
  list.unshift(entry);
  saveAll(list);
  return true;
}

/** Mark a request completed/rejected and record who handled it + when. */
export function resolveRequest(id: number, status: "completed" | "rejected", handledBy: string): void {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const list = getResetRequests().map((r) =>
    r.id === id ? { ...r, status, handled_by: handledBy, handled_at: now } : r
  );
  saveAll(list);
}

export function countPending(): number {
  return getResetRequests().filter((r) => r.status === "pending").length;
}
