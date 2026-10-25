// ============================================================================
// FILE: src/data/leaveRequests.ts
// PURPOSE: Staff leave requests. Frontend-only store (localStorage) that mirrors
//          the backend `leave_requests` table so it maps 1-to-1 later.
//
// TODO(API): when linked to the backend, replace these helpers with:
//   GET   /api/leave?staff_id=         (staff: own; admin: all)
//   POST  /api/leave                   (staff submit)
//   PATCH /api/leave/:id/approve        (admin)
//   PATCH /api/leave/:id/reject         (admin)
//   DELETE /api/leave/:id               (staff cancel own pending)
// ============================================================================

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: number;
  staff_id: string;        // links to the staff record
  staff_name: string;
  leave_type: string;      // Annual / Sick / Casual / Study / Other
  start_date: string;      // "YYYY-MM-DD"
  end_date: string;        // "YYYY-MM-DD"
  reason: string;
  status: LeaveStatus;
  created_at: string;      // "YYYY-MM-DD HH:MM"
  handled_by: string | null;
  handled_at: string | null;
}

const KEY = "gvu_leave_requests";

export function getLeaveRequests(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LeaveRequest[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: LeaveRequest[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// Staff: only their own requests. Admin: pass undefined to get all.
export function getLeaveFor(staffId?: string): LeaveRequest[] {
  const all = getLeaveRequests();
  return staffId ? all.filter((l) => l.staff_id === staffId) : all;
}

export function addLeaveRequest(
  req: Omit<LeaveRequest, "id" | "status" | "created_at" | "handled_by" | "handled_at">
): LeaveRequest {
  const list = getLeaveRequests();
  const entry: LeaveRequest = {
    ...req,
    id: Date.now(),
    status: "pending",
    created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    handled_by: null,
    handled_at: null,
  };
  list.unshift(entry);
  saveAll(list);
  return entry;
}

export function setLeaveStatus(id: number, status: "approved" | "rejected", handledBy: string): void {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  saveAll(getLeaveRequests().map((l) =>
    l.id === id ? { ...l, status, handled_by: handledBy, handled_at: now } : l
  ));
}

export function cancelLeaveRequest(id: number): void {
  saveAll(getLeaveRequests().filter((l) => l.id !== id));
}

export function countPendingLeave(): number {
  return getLeaveRequests().filter((l) => l.status === "pending").length;
}

// Count days (inclusive) between two ISO dates.
export function leaveDays(start: string, end: string): number {
  const a = new Date(start + "T00:00");
  const b = new Date(end + "T00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}
