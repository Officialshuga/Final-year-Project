// ============================================================================
// GVU STAFF ATTENDANCE — App entry (replaces default App.tsx)
// Project: "Design and Implementation of a Biometric Staff Attendance
//           Management System" for Glorious Vision University (GVU)
//
// ----------------------------------------------------------------------------
// FOLDER STRUCTURE (what / where):
//   index.html                  -> title, favicon (GVU crest), mounts #root
//   src/main.tsx                -> React entry, imports index.css + App
//   src/index.css               -> Tailwind + dark-mode + scanner animations
//   src/data/mockDatabase.ts    -> ALL mock data (7 tables) + ROLE_MENUS map
//   src/components/GvuLogo.tsx  -> GVU crest, used on every page
//   src/components/Common.tsx   -> Toasts, ConfirmDialog, Modal, badges, states
//   src/components/Layout.tsx   -> Sidebar + Topbar shell (auth pages only)
//   src/pages/LoginPage.tsx         (1) Login
//   src/pages/Dashboard.tsx         (2) Dashboard
//   src/pages/StaffManagement.tsx   (3) Staff
//   src/pages/BiometricEnrolment.tsx(4) Enrolment
//   src/pages/AttendanceTerminal.tsx(5) Kiosk
//   src/pages/AttendanceRecords.tsx (6) Records
//   src/pages/Reports.tsx           (7) Reports
//   src/pages/DepartmentsShifts.tsx (8) Departments & Shifts
//   src/pages/AuditLogs.tsx         (9) Audit logs
//   src/pages/UsersRoles.tsx        (10) Users & roles
//
// HOW TO RUN (frontend only):
//   1. npm install
//   2. npm run dev   -> open http://localhost:5173
//   3. Sign in with: admin/admin123 (Admin), hr.officer/hr123 (HR),
//      supervisor/sup123 (Supervisor)
//   4. npm run build -> produces dist/index.html for deployment
//
// WHERE THE BACKEND PLUGS IN (search for TODO(API) in the code):
//   - LoginPage:      POST /api/auth/login
//   - Dashboard:      GET  /api/dashboard/summary, /api/attendance/weekly
//   - Staff:          GET/POST/PUT/PATCH /api/staff
//   - Enrolment:      POST /api/biometrics/enroll
//   - Terminal:       POST /api/attendance/clock-in
//   - Records:        GET  /api/attendance + /export?format=
//   - Reports:        GET  /api/reports/daily|weekly|monthly
//   - Departments:    GET/POST/PUT /api/departments, /api/shifts
//   - Audit:          GET  /api/audit-logs
//   - Users:          GET/POST/PATCH /api/users
//   Keep the same field names as mockDatabase.ts so swap-in is painless.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import Layout, { type PageKey } from "./components/Layout";
import { ToastStack, ConfirmDialog, type ToastMsg } from "./components/Common";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import StaffManagement from "./pages/StaffManagement";
import BiometricEnrolment from "./pages/BiometricEnrolment";
import AttendanceTerminal from "./pages/AttendanceTerminal";
import AttendanceRecords from "./pages/AttendanceRecords";
import Reports from "./pages/Reports";
import DepartmentsShifts from "./pages/DepartmentsShifts";
import AuditLogs from "./pages/AuditLogs";
import UsersRoles from "./pages/UsersRoles";
import Profile from "./pages/Profile";
import PasswordRequests from "./pages/PasswordRequests";
import LeavePage from "./pages/LeavePage";
import { users, ROLE_MENUS, type UserRole } from "./data/mockDatabase";

// Session shape saved to localStorage (so refresh keeps you logged in)
interface Session { username: string; role: UserRole; }

export default function App() {
  // ---- Theme (light/dark) ----
  const [dark, setDark] = useState(() => localStorage.getItem("gvu_theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("gvu_theme", dark ? "dark" : "light");
  }, [dark]);

  // ---- Auth session ----
  // TODO(API): on reload, validate saved JWT: GET /api/auth/me with Authorization header
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem("gvu_session");
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch { return null; }
  });

  // Current full user object (for name display). Falls back gracefully.
  const currentUser = users.find((u) => u.username === session?.username) ?? {
    user_id: 0, username: session?.username ?? "guest", password: "",
    full_name: session?.username ?? "Guest", role: (session?.role ?? "Staff") as UserRole,
    active: true, last_login: "now",
  };

  // ---- Navigation ----
  const [page, setPage] = useState<PageKey>("dashboard");

  // ---- Toasts (tiny custom system — no library needed, beginner friendly) ----
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const notify = useCallback((type: ToastMsg["type"], title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // ---- Logout confirm ----
  const [confirmLogout, setConfirmLogout] = useState(false);

  function handleLogin(username: string, role: UserRole) {
    // TODO(API): store real JWT instead: localStorage.setItem('gvu_token', token)
    const s: Session = { username, role };
    localStorage.setItem("gvu_session", JSON.stringify(s));
    setSession(s);
    setPage("dashboard");
  }

  function handleLogout() {
    // TODO(API): POST /api/auth/logout (invalidate server session / token)
    localStorage.removeItem("gvu_session");
    setSession(null);
    setPage("dashboard");
    setConfirmLogout(false);
  }

  function navigate(p: PageKey) {
    // Role guard: block pages hidden for this role
    const allowed = ROLE_MENUS[currentUser.role];
    if (!allowed.includes(p)) {
      notify("error", "Access denied", `The ${currentUser.role} role cannot open that page.`);
      return;
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Not logged in -> show Login only ----
  if (!session) {
    return (
      <div className={dark ? "dark" : ""}>
        <ToastStack toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
        <LoginPage onLogin={handleLogin} notify={notify} dark={dark} onToggleTheme={() => setDark(!dark)} />
      </div>
    );
  }

  // ---- Logged in -> sidebar + topbar shell + active page ----
  return (
    <div className={dark ? "dark" : ""}>
      <ToastStack toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      <Layout
        user={currentUser}
        page={page}
        onNavigate={navigate}
        onLogout={() => setConfirmLogout(true)}
        dark={dark}
        onToggleTheme={() => setDark(!dark)}
      >
        {page === "dashboard" && <Dashboard onGo={navigate} currentUser={currentUser} />}
        {page === "staff" && <StaffManagement notify={notify} />}
        {page === "enrolment" && <BiometricEnrolment notify={notify} currentUser={currentUser} />}
        {page === "terminal" && <AttendanceTerminal notify={notify} />}
        {page === "records" && <AttendanceRecords notify={notify} currentUser={currentUser} />}
        {page === "reports" && <Reports currentUser={currentUser} />}
        {page === "departments" && <DepartmentsShifts notify={notify} />}
        {page === "audit" && <AuditLogs currentUser={currentUser} />}
        {page === "users" && <UsersRoles notify={notify} currentUser={currentUser} />}
        {page === "requests" && <PasswordRequests notify={notify} currentUser={currentUser} />}
        {page === "leave" && <LeavePage notify={notify} currentUser={currentUser} />}
        {page === "profile" && <Profile notify={notify} currentUser={currentUser} />}
      </Layout>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message={`You are signed in as ${currentUser.full_name} (${currentUser.role}). Any unsaved demo changes will be lost.`}
        confirmLabel="Sign out"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
