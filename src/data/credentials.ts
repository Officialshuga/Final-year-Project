// ============================================================================
// FILE: src/data/credentials.ts
// PURPOSE: ALL login credentials live HERE in one place, kept separate from the
//          rest of the app data so they are easy to manage and keep private.
// ----------------------------------------------------------------------------
// SECURITY NOTES (frontend-only demo):
//   - These credentials are NOT shown anywhere on the login screen, so a staff
//     member cannot read the admin password off the page.
//   - In a real/production system these never live in frontend code at all —
//     they sit in the backend database (hashed with bcrypt). See the `backend/`
//     folder: this exact list maps to the `users` table + seed.py.
//   - Keep this file out of screenshots / share it only with the administrator.
//
// ROLES:
//   "Admin" -> full access to every page
//   "Staff" -> personal access only (own dashboard, enrolment, attendance, etc.)
// ============================================================================
import type { UserRole } from "./mockDatabase";

export interface Credential {
  username: string;
  password: string;
  full_name: string;
  role: UserRole;
  staff_id?: string; // links a Staff login to their staff record
}

// ---- The single source of truth for who can sign in ----
export const credentials: Credential[] = [
  // Administrator (you). Keep this password private.
  { username: "admin", password: "admin123", full_name: "System Administrator", role: "Admin" },

  // Staff logins are added here (or created by the Admin in the app).
  // Example of how a staff login would look:
  // { username: "a.mensah", password: "staff123", full_name: "Adaeze Mensah", role: "Staff", staff_id: "GVU/2022/001" },
];

// Helper: find a credential by username (case-insensitive).
export function findCredential(username: string): Credential | undefined {
  return credentials.find((c) => c.username.toLowerCase() === username.trim().toLowerCase());
}
