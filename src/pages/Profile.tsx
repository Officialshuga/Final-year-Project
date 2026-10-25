// ============================================================================
// PAGE: My Profile (Staff portal)
//   • Read-only profile: name, staff ID, department, shift
//   • Change password form (with validation)
//   • Notifications list (personal + broadcasts), mark-as-read
// TODO(API):
//   GET   /api/staff/:id            -> profile
//   PUT   /api/users/:id/password   -> change password
//   GET   /api/notifications?staff_id=
//   PATCH /api/notifications/:id/read
// ============================================================================
import { useState } from "react";
import { UserCircle, IdCard, Building2, Clock3, Mail, Phone, Lock, Eye, EyeOff, Bell, CheckCheck, Fingerprint } from "lucide-react";
import { staffById, deptName, shiftName, shifts, notifications as seedNotifs, biometric_templates, type AppUser, type Notification } from "../data/mockDatabase";
import { EmptyState, inputCls, labelCls } from "../components/Common";

export default function Profile({ notify, currentUser }: {
  notify: (t: "success" | "error" | "info", title: string, body?: string) => void;
  currentUser: AppUser;
}) {
  const me = currentUser.staff_id ? staffById(currentUser.staff_id) : undefined;
  const myShift = me ? shifts.find((s) => s.shift_id === me.shift_id) : undefined;
  const myTemplates = biometric_templates.filter((t) => t.staff_id === currentUser.staff_id);

  // ---- Change password state ----
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  // ---- Notifications state (local copy so "mark read" works) ----
  const [notifs, setNotifs] = useState<Notification[]>(
    seedNotifs.filter((n) => n.staff_id === "all" || n.staff_id === currentUser.staff_id)
  );
  const unread = notifs.filter((n) => !n.read).length;

  function changePassword(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!curPw) e.cur = "Enter your current password.";
    else if (curPw !== currentUser.password) e.cur = "Current password is incorrect.";
    if (newPw.length < 6) e.new = "New password must be at least 6 characters.";
    if (newPw && curPw && newPw === curPw) e.new = "New password must be different from the current one.";
    if (confirmPw !== newPw) e.confirm = "Passwords do not match.";
    setPwErrors(e);
    if (Object.keys(e).length) return;

    // TODO(API): PUT /api/users/:id/password { current, new }
    // Frontend-only: we can't persist, so just confirm success.
    notify("success", "Password changed", "Your password has been updated.");
    setCurPw(""); setNewPw(""); setConfirmPw(""); setPwErrors({});
  }

  function markAllRead() {
    setNotifs((p) => p.map((n) => ({ ...n, read: true })));
    notify("info", "All caught up", "All notifications marked as read.");
  }
  function markOneRead(id: number) {
    setNotifs((p) => p.map((n) => (n.notif_id === id ? { ...n, read: true } : n)));
  }

  // Not a staff account (e.g. Admin somehow) — show a gentle note.
  if (!me) {
    return (
      <div className="animate-fade-up">
        <div className="rounded-2xl border border-blue-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <EmptyState title="No profile linked" body="This account is not linked to a staff record." />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      {/* Profile header card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-blue-900 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${me.avatar_color} text-2xl font-black text-white ring-4 ring-white/25`}>
            {me.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div>
            <h2 className="text-2xl font-black sm:text-3xl">{me.full_name}</h2>
            <p className="mt-1 text-sm text-blue-100">{me.role_title} • {deptName(me.department_id)}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
              <IdCard size={13} /> {me.staff_id}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Read-only profile details */}
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm xl:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 font-extrabold"><UserCircle size={18} className="text-blue-700" /> My details</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">These are managed by HR/Admin and are read-only.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { icon: UserCircle, label: "Full name", value: me.full_name },
              { icon: IdCard, label: "Staff ID", value: me.staff_id },
              { icon: Building2, label: "Department", value: deptName(me.department_id) },
              { icon: Clock3, label: "Shift", value: `${shiftName(me.shift_id)}${myShift ? ` (${myShift.start_time}–${myShift.end_time})` : ""}` },
              { icon: Mail, label: "Email", value: me.email },
              { icon: Phone, label: "Phone", value: me.phone },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-start gap-3 rounded-xl bg-blue-50/60 p-3.5 dark:bg-slate-800/60">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white"><Icon size={16} /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase dark:text-slate-400">{f.label}</p>
                    <p className="truncate font-bold text-slate-800 dark:text-slate-100">{f.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Biometric status */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-blue-100 p-3.5 dark:border-slate-800">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950"><Fingerprint size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase dark:text-slate-400">Biometric enrolment</p>
              <p className="font-bold text-slate-800 dark:text-slate-100">{me.enrolled ? `${myTemplates.length || 1} fingerprint(s) enrolled` : "Not enrolled yet"}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${me.enrolled ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
              {me.enrolled ? "ENROLLED" : "PENDING"}
            </span>
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 font-extrabold"><Lock size={17} className="text-blue-700" /> Change password</h3>
          <form onSubmit={changePassword} className="mt-4 space-y-3">
            <div>
              <label className={labelCls}>Current password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={curPw} onChange={(e) => setCurPw(e.target.value)} className={inputCls + " pr-10"} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              {pwErrors.cur && <p className="mt-1 text-xs font-semibold text-red-600">{pwErrors.cur}</p>}
            </div>
            <div>
              <label className={labelCls}>New password</label>
              <input type={showPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls} placeholder="At least 6 characters" />
              {pwErrors.new && <p className="mt-1 text-xs font-semibold text-red-600">{pwErrors.new}</p>}
            </div>
            <div>
              <label className={labelCls}>Confirm new password</label>
              <input type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} placeholder="Re-type new password" />
              {pwErrors.confirm && <p className="mt-1 text-xs font-semibold text-red-600">{pwErrors.confirm}</p>}
            </div>
            <button className="w-full rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">Update password</button>
          </form>
          <p className="mt-3 text-[11px] text-slate-400">Tip: current demo password is <b>staff123</b>.</p>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-extrabold">
            <Bell size={17} className="text-blue-700" /> Notifications
            {unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">{unread} new</span>}
          </h3>
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>

        {notifs.length === 0 ? (
          <div className="mt-4"><EmptyState title="No notifications" body="You're all caught up." /></div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {[...notifs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((n) => {
              const dot = n.type === "success" ? "bg-blue-600" : n.type === "warning" ? "bg-sky-500" : "bg-blue-400";
              return (
                <li key={n.notif_id} className={`flex gap-3 rounded-xl border p-4 ${n.read ? "border-blue-50 bg-white dark:border-slate-800 dark:bg-slate-900" : "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30"}`}>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-slate-300" : dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-extrabold text-slate-800 dark:text-slate-100">{n.title}</p>
                      {n.staff_id === "all" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">BROADCAST</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{n.date}</p>
                  </div>
                  {!n.read && (
                    <button onClick={() => markOneRead(n.notif_id)} title="Mark as read" className="self-start rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:text-blue-300">Read</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
