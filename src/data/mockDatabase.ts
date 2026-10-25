// ============================================================================
// FILE: src/data/mockDatabase.ts
// PURPOSE: Single place for ALL data, shaped like the real database tables.
// ----------------------------------------------------------------------------
// ROLES IN THIS SYSTEM:
//   • Admin  -> sees EVERYTHING (dashboard, staff, enrolment, terminal,
//               records, reports, departments, audit logs, users & roles)
//   • Staff  -> sees ONLY their own things (dashboard, biometric enrolment,
//               attendance, personal reports, their own audit logs)
//
// Each Staff login is linked to a staff record by `staff_id`, so the
// personal pages can filter data down to just that person.
//
// TODO(API): Replace each exported array below with a real API call. Keep the
// same field names so the backend maps 1-to-1. Search for "TODO(API)".
// ============================================================================

// All login passwords live in ONE separate file (credentials.ts).
import { credentials } from "./credentials";

// ----------------------------------------------------------------------------
// 1. DEPARTMENTS
// ----------------------------------------------------------------------------
export interface Department {
  department_id: number;
  name: string;
  code: string;
  head: string;
  staff_count?: number;
}

// No departments yet — the Administrator adds them in the app (and they will be
// saved to the database once the backend and frontend are linked).
// TODO(API): GET /api/departments
export const departments: Department[] = [];

// ----------------------------------------------------------------------------
// 2. SHIFTS
// ----------------------------------------------------------------------------
export interface Shift {
  shift_id: number;
  name: string;
  start_time: string;
  end_time: string;
  late_after: string; // arrival after this time = Late
}

// No shifts yet — the Administrator adds them in the app (and they will be
// saved to the database once the backend and frontend are linked).
// TODO(API): GET /api/shifts
export const shifts: Shift[] = [];

// ----------------------------------------------------------------------------
// 3. STAFF
// ----------------------------------------------------------------------------
export interface StaffMember {
  staff_id: string;
  full_name: string;
  email: string;
  phone: string;
  department_id: number;
  shift_id: number;
  role_title: string;
  status: "Active" | "Inactive";
  enrolled: boolean;
  avatar_color: string; // blue-family gradients only
  date_joined: string;
}

// No staff yet — the Administrator will add staff through Staff Management.
// TODO(API): GET /api/staff
export const staff: StaffMember[] = [];

// ----------------------------------------------------------------------------
// 4. BIOMETRIC TEMPLATES
// ----------------------------------------------------------------------------
export interface BiometricTemplate {
  template_id: number;
  staff_id: string;
  finger: string;
  enrolled_on: string;
  quality_score: number;
}

// No enrolments yet. TODO(API): GET /api/biometrics
export const biometric_templates: BiometricTemplate[] = [];

// ----------------------------------------------------------------------------
// 5. ATTENDANCE (generated 14 days of history + today)
// ----------------------------------------------------------------------------
export interface AttendanceRecord {
  attendance_id: number;
  staff_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: "Present" | "Late" | "Absent";
}

// No attendance yet — records are created when staff clock in at the terminal.
// TODO(API): GET /api/attendance
export const attendance: AttendanceRecord[] = [];

// ----------------------------------------------------------------------------
// 6. USERS — people who can LOG IN
//    role "Admin" = full access. role "Staff" = personal access only.
//    Staff accounts carry a `staff_id` that links them to their staff record.
//    TODO(API): POST /api/auth/login { username, password }
// ----------------------------------------------------------------------------
export type UserRole = "Admin" | "Staff";

export interface AppUser {
  user_id: number;
  username: string;
  password: string;      // DEMO ONLY — never store plain text in production
  full_name: string;
  role: UserRole;
  active: boolean;
  last_login: string;
  staff_id?: string;     // set for Staff accounts; undefined for Admin
}

// Login accounts are built from the SINGLE credentials file
// (src/data/credentials.ts) so every password lives in exactly one place.
export const users: AppUser[] = credentials.map((c, i) => ({
  user_id: i + 1,
  username: c.username,
  password: c.password,
  full_name: c.full_name,
  role: c.role,
  active: true,
  last_login: "Never",
  staff_id: c.staff_id,
}));

// ----------------------------------------------------------------------------
// 7. AUDIT LOGS
//    TODO(API): GET /api/audit-logs?user=&action=&from=&to=
// ----------------------------------------------------------------------------
export interface AuditLog {
  log_id: number;
  timestamp: string;
  username: string;
  action: string;
  details: string;
}

// No activity yet. TODO(API): GET /api/audit-logs
export const audit_logs: AuditLog[] = [];

// ----------------------------------------------------------------------------
// 8. NOTIFICATIONS — short messages shown to a user (per staff_id, or "all")
//    TODO(API): GET /api/notifications?staff_id=
// ----------------------------------------------------------------------------
export interface Notification {
  notif_id: number;
  staff_id: string | "all"; // "all" = broadcast to everyone
  title: string;
  body: string;
  date: string;             // "YYYY-MM-DD HH:mm"
  type: "info" | "success" | "warning";
  read: boolean;
}

// No notifications yet. TODO(API): GET /api/notifications
export const notifications: Notification[] = [];

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
export function deptName(id: number): string {
  return departments.find((d) => d.department_id === id)?.name ?? "—";
}

// Work out hours between two "HH:mm" strings. Returns 0 if either is missing.
export function hoursBetween(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const [h1, m1] = checkIn.split(":").map(Number);
  const [h2, m2] = checkOut.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // crossed midnight (night shift)
  return Math.round((mins / 60) * 10) / 10; // 1 decimal place
}
export function deptCode(id: number): string {
  return departments.find((d) => d.department_id === id)?.code ?? "—";
}
export function shiftName(id: number): string {
  return shifts.find((s) => s.shift_id === id)?.name ?? "—";
}
export function staffById(id: string): StaffMember | undefined {
  return staff.find((s) => s.staff_id === id);
}
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ----------------------------------------------------------------------------
// ROLE -> VISIBLE MENU KEYS  (drives sidebar + page access guard)
//   Admin: everything.
//   Staff: dashboard, biometric enrolment, attendance records, reports, audit.
// TODO(API): backend should return permissions[] with the login response.
// ----------------------------------------------------------------------------
export const ROLE_MENUS: Record<UserRole, string[]> = {
  Admin: ["dashboard", "staff", "enrolment", "terminal", "records", "reports", "departments", "leave", "requests", "audit", "users"],
  Staff: ["dashboard", "enrolment", "records", "reports", "leave", "profile", "audit"],
};
