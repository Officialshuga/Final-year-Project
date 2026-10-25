// ============================================================================
// COMPONENT: Layout — shared Sidebar + Topbar used by ALL authenticated pages.
// - Sidebar: GVU crest, role-filtered nav, collapse on mobile
// - Topbar: page title, live date, dark-mode toggle, user chip, logout
// ============================================================================
import { useState } from "react";
import {
  LayoutDashboard, Users, Fingerprint, ScanLine, ClipboardList,
  BarChart3, Building2, ScrollText, ShieldCheck, LogOut, Menu, X,
  Moon, Sun, Bell, UserCircle, KeyRound, Plane,
} from "lucide-react";
import GvuLogo from "./GvuLogo";
import type { AppUser } from "../data/mockDatabase";
import { ROLE_MENUS, notifications } from "../data/mockDatabase";
import { countPending } from "../data/resetRequests";
import { countPendingLeave } from "../data/leaveRequests";

// Page keys must match App.tsx
export type PageKey = "dashboard" | "staff" | "enrolment" | "terminal" | "records" | "reports" | "departments" | "audit" | "users" | "profile" | "requests" | "leave";

const NAV: Array<{ key: PageKey; label: string; icon: any; hint: string }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview & today" },
  { key: "staff", label: "Staff Management", icon: Users, hint: "Directory & profiles" },
  { key: "enrolment", label: "Biometric Enrolment", icon: Fingerprint, hint: "Register fingers" },
  { key: "terminal", label: "Attendance Terminal", icon: ScanLine, hint: "Kiosk check-in" },
  { key: "records", label: "Attendance Records", icon: ClipboardList, hint: "History & export" },
  { key: "reports", label: "Reports", icon: BarChart3, hint: "Analytics" },
  { key: "departments", label: "Departments & Shifts", icon: Building2, hint: "Structure" },
  { key: "leave", label: "Leave Requests", icon: Plane, hint: "Apply & approve" },
  { key: "requests", label: "Password Requests", icon: KeyRound, hint: "Reset requests" },
  { key: "profile", label: "My Profile", icon: UserCircle, hint: "Profile & password" },
  { key: "audit", label: "Audit Logs", icon: ScrollText, hint: "Activity trail" },
  { key: "users", label: "Users & Roles", icon: ShieldCheck, hint: "Access control" },
];

export const PAGE_TITLES: Record<PageKey, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Today's attendance at a glance" },
  staff: { title: "Staff Management", sub: "Search, add, edit and deactivate staff" },
  enrolment: { title: "Biometric Enrolment", sub: "Register staff fingerprints" },
  terminal: { title: "Attendance Terminal", sub: "Kiosk mode — tap to clock in" },
  records: { title: "Attendance Records", sub: "Filter history and export" },
  reports: { title: "Reports & Analytics", sub: "Daily, weekly and monthly insights" },
  departments: { title: "Departments & Shifts", sub: "Organise people and work hours" },
  leave: { title: "Leave Requests", sub: "Apply for leave and track approvals" },
  requests: { title: "Password Requests", sub: "Review and action password resets" },
  profile: { title: "My Profile", sub: "Your details, password and notifications" },
  audit: { title: "Audit Logs", sub: "Who did what, and when" },
  users: { title: "Users & Roles", sub: "Control who can access what" },
};

interface Props {
  user: AppUser;
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  onLogout: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, page, onNavigate, onLogout, dark, onToggleTheme, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const allowed = ROLE_MENUS[user.role]; // hide menu items not allowed for role
  const visibleNav = NAV.filter((n) => allowed.includes(n.key));
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Unread notifications for this user (their own + broadcasts).
  const myUnread = notifications.filter(
    (n) => !n.read && (n.staff_id === "all" || n.staff_id === user.staff_id)
  ).length;
  const canSeeProfile = allowed.includes("profile");
  // Pending password-reset requests (for the sidebar badge).
  const pendingRequests = countPending();
  // Pending leave requests — only badge the admin (who approves them).
  const pendingLeave = user.role === "Admin" ? countPendingLeave() : 0;

  const sidebarBody = (
    <div className="flex h-full flex-col">
      {/* GVU brand — visible on every page via sidebar */}
      <div className="border-b border-blue-800/40 px-5 pt-5 pb-4">
        <GvuLogo light compact={false} />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-extrabold tracking-[0.2em] text-blue-300/80 uppercase">Main menu • {user.role}</p>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key); setMobileOpen(false); }}
              className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                active ? "bg-white text-blue-800 shadow-lg shadow-blue-950/30" : "text-blue-100 hover:bg-blue-800/70 hover:text-white"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-blue-700 text-white" : "bg-blue-800/70 text-blue-200 group-hover:bg-blue-700 group-hover:text-white"}`}>
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                <span className={`block truncate text-[11px] font-medium ${active ? "text-blue-600" : "text-blue-300/80"}`}>{item.hint}</span>
              </span>
              {/* Pending password-request badge on the Password Requests item */}
              {item.key === "requests" && pendingRequests > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{pendingRequests}</span>
              )}
              {/* Pending leave badge (admin only) */}
              {item.key === "leave" && pendingLeave > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{pendingLeave}</span>
              )}
              {active && item.key !== "requests" && item.key !== "leave" && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
        {/* hidden-by-role note (helps examiners see RBAC working) */}
        {allowed.length < NAV.length && (
          <p className="px-3 pt-3 text-[11px] leading-relaxed text-blue-300/70">
            {NAV.length - allowed.length} menu item(s) hidden for <b>{user.role}</b> role.
          </p>
        )}
      </nav>

      {/* Sidebar footer: mini user + GVU */}
      <div className="border-t border-blue-800/40 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-blue-800/60 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-blue-500 text-sm font-black text-blue-950">
            {user.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{user.full_name}</p>
            <p className="text-[11px] text-blue-200">@{user.username} • {user.role}</p>
          </div>
          <button onClick={onLogout} title="Logout" className="rounded-lg p-2 text-blue-200 hover:bg-red-600 hover:text-white"><LogOut size={16} /></button>
        </div>
        <p className="mt-3 text-center text-[10px] tracking-widest text-blue-300/70 uppercase">© 2026 Glorious Vision University</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[290px] bg-gradient-to-b from-blue-900 via-blue-900 to-indigo-950 lg:block">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] bg-gradient-to-b from-blue-900 to-indigo-950 shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 rounded-lg p-2 text-blue-200 hover:bg-blue-800"><X size={18} /></button>
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-[290px]">
        {/* ---- Topbar (GVU crest also here for kiosk/tablet visibility) ---- */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 p-2.5 lg:hidden dark:border-slate-700" aria-label="Open menu">
              <Menu size={18} />
            </button>
            {/* mini GVU for mobile topbar */}
            <div className="lg:hidden"><GvuLogo size={34} showText={false} /></div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">{PAGE_TITLES[page].title}</h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">{PAGE_TITLES[page].sub} • {today}</p>
            </div>
            {/* notification bell — opens My Profile (notifications live there) */}
            <button
              onClick={() => canSeeProfile && onNavigate("profile")}
              title={canSeeProfile ? "View notifications" : "Notifications"}
              className="relative hidden rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 sm:block dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bell size={17} />
              {myUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white">{myUnread}</span>
              )}
            </button>
            {/* dark mode toggle */}
            <button onClick={onToggleTheme} title="Toggle light / dark mode" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-amber-300 dark:hover:bg-slate-800">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {/* user chip */}
            <div className="hidden items-center gap-2.5 rounded-xl bg-blue-50 py-1.5 pr-3 pl-1.5 md:flex dark:bg-blue-950/50">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xs font-black text-white">
                {user.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <span className="leading-tight">
                <span className="block max-w-[140px] truncate text-xs font-extrabold">{user.full_name}</span>
                <span className="block text-[10px] font-bold tracking-wider text-blue-700 uppercase dark:text-blue-300">{user.role}</span>
              </span>
            </div>
            <button onClick={onLogout} className="flex items-center gap-2 rounded-xl bg-blue-700 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
              <LogOut size={15} /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>

        {/* Footer with GVU on every page */}
        <footer className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-[11px] text-slate-500 sm:flex-row dark:text-slate-400">
            <span className="flex items-center gap-2"><GvuLogo size={20} showText={false} /> Glorious Vision University • ICT Directorate</span>
            <span>Biometric Staff Attendance Management System</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
