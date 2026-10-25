// ============================================================================
// PAGE 10: Users & Roles — list with role badges + per-role menu visibility
// (Demonstrates "show or hide menu items based on selected role")
// TODO(API):
//   GET /api/users   POST /api/users   PATCH /api/users/:id/active
// ============================================================================
import { useState } from "react";
import { ShieldCheck, Plus, Power, Check, X, Trash2, KeyRound } from "lucide-react";
import { users as seedUsers, ROLE_MENUS, type AppUser, type UserRole } from "../data/mockDatabase";
import { Modal, ConfirmDialog, RoleBadge, StatusBadge, EmptyState, inputCls, labelCls } from "../components/Common";
import { generateTempPassword } from "../utils/password";
import TempPasswordModal from "../components/TempPasswordModal";

const ALL_MENUS = [
  ["dashboard", "Dashboard"], ["staff", "Staff Management"], ["enrolment", "Biometric Enrolment"],
  ["terminal", "Attendance Terminal"], ["records", "Attendance Records"], ["reports", "Reports"],
  ["departments", "Departments & Shifts"], ["audit", "Audit Logs"], ["users", "Users & Roles"],
] as const;

export default function UsersRoles({ notify, currentUser }: {
  notify: (t: "success" | "error" | "info", title: string, body?: string) => void;
  currentUser: AppUser;
}) {
  const [rows, setRows] = useState<AppUser[]>(seedUsers);
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [nUser, setNUser] = useState(""); const [nName, setNName] = useState(""); const [nRole, setNRole] = useState<UserRole>("Staff");
  // User account the admin is about to delete (null = no confirm shown).
  const [deleteUser, setDeleteUser] = useState<AppUser | null>(null);
  // Direct password reset from user management (no request needed).
  const [tempPw, setTempPw] = useState<{ who: string; password: string } | null>(null);

  function directReset(u: AppUser) {
    // TODO(API): PATCH /api/users/:id/reset-password -> backend hashes temp pw,
    // sets must_change_password, expires 24h, invalidates sessions, returns once.
    const temp = generateTempPassword(12);
    setTempPw({ who: `${u.full_name} (@${u.username})`, password: temp });
    notify("success", "Password reset", `A temporary password was generated for @${u.username}.`);
  }

  const filtered = rows.filter((u) => roleFilter === "all" || u.role === roleFilter);
  // Only Admin can manage users — others see read-only notice
  const canManage = currentUser.role === "Admin";

  function toggleActive(u: AppUser) {
    // TODO(API): PATCH /api/users/:id/active
    setRows((p) => p.map((x) => (x.user_id === u.user_id ? { ...x, active: !x.active } : x)));
    notify("info", u.active ? "User deactivated" : "User reactivated", u.username);
  }

  function addUser(ev: React.FormEvent) {
    ev.preventDefault();
    if (nUser.trim().length < 3 || nName.trim().length < 3) { notify("error", "Check fields", "Username and full name required."); return; }
    // TODO(API): POST /api/users { username, full_name, role, temp_password }
    setRows((p) => [...p, { user_id: Math.max(...p.map((x) => x.user_id)) + 1, username: nUser.trim(), password: "changeme123", full_name: nName.trim(), role: nRole, active: true, last_login: "Never" }]);
    setModal(false); setNUser(""); setNName("");
    notify("success", "User created", `${nUser} with role ${nRole}. Temp password: changeme123`);
  }

  // Permanently remove a login account.
  function confirmDelete() {
    if (!deleteUser) return;
    // TODO(API): DELETE /api/users/:id
    setRows((p) => p.filter((x) => x.user_id !== deleteUser.user_id));
    notify("success", "User deleted", `Login "${deleteUser.username}" was removed.`);
    setDeleteUser(null);
  }

  return (
    <div className="animate-fade-up space-y-5">
      {!canManage && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          You are signed in as <b>{currentUser.role}</b> — user management is read-only. Sign in as <b>Admin</b> to add or deactivate users.
        </div>
      )}

      {/* Role permission matrix — proves RBAC to examiners */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="flex items-center gap-2 font-extrabold"><ShieldCheck size={17} className="text-blue-700" /> What each role can see</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-center text-xs">
            <thead>
              <tr className="text-[11px] tracking-widest text-slate-500 uppercase">
                <th className="py-2 text-left">Menu item</th>
                {(["Admin", "Staff"] as UserRole[]).map((r) => <th key={r} className="py-2"><RoleBadge role={r} /></th>)}
              </tr>
            </thead>
            <tbody>
              {ALL_MENUS.map(([key, label]) => (
                <tr key={key} className="border-t border-blue-50 dark:border-slate-800">
                  <td className="py-2 text-left font-bold">{label}</td>
                  {(["Admin", "Staff"] as UserRole[]).map((r) => (
                    <td key={r} className="py-2">
                      {ROLE_MENUS[r].includes(key)
                        ? <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Check size={14} /></span>
                        : <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-400 dark:bg-slate-700"><X size={14} /></span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-extrabold">System users ({filtered.length})</h3>
          <div className="flex gap-2">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls + " sm:w-44"}>
              <option value="all">All roles</option><option>Admin</option><option>Staff</option>
            </select>
            {canManage && <button onClick={() => setModal(true)} className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-800"><Plus size={14} /> Add user</button>}
          </div>
        </div>

        {filtered.length === 0 ? <div className="mt-4"><EmptyState title="No users in this role" /></div> : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white">
                  {u.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{u.full_name} {u.username === currentUser.username && <span className="text-[10px] text-blue-600">(you)</span>}</p>
                  <p className="text-xs text-slate-500">@{u.username} • last login {u.last_login}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5"><RoleBadge role={u.role} /><StatusBadge status={u.active ? "Active" : "Inactive"} /></p>
                </div>
                {canManage && u.username !== currentUser.username && (
                  <div className="flex gap-1.5">
                    <button onClick={() => directReset(u)} title="Reset password" className="rounded-xl bg-blue-50 p-2.5 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40">
                      <KeyRound size={16} />
                    </button>
                    <button onClick={() => toggleActive(u)} title={u.active ? "Deactivate" : "Reactivate"} className={`rounded-xl p-2.5 ${u.active ? "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
                      <Power size={16} />
                    </button>
                    <button onClick={() => setDeleteUser(u)} title="Delete user" className="rounded-xl bg-red-50 p-2.5 text-red-600 hover:bg-red-100 dark:bg-red-950/40">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add system user" subtitle="They will sign in with a temporary password">
        <form onSubmit={addUser} className="space-y-4">
          <div><label className={labelCls}>Full name *</label><input value={nName} onChange={(e) => setNName(e.target.value)} className={inputCls} placeholder="e.g. Mary Johnson" /></div>
          <div><label className={labelCls}>Username *</label><input value={nUser} onChange={(e) => setNUser(e.target.value)} className={inputCls} placeholder="e.g. mary.j" /></div>
          <div>
            <label className={labelCls}>Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["Admin", "Staff"] as UserRole[]).map((r) => (
                <button type="button" key={r} onClick={() => setNRole(r)} className={`rounded-xl border px-2 py-2.5 text-xs font-extrabold ${nRole === r ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 dark:border-slate-700"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button>
            <button className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white">Create user</button>
          </div>
        </form>
      </Modal>

      {/* Delete user confirmation */}
      <ConfirmDialog
        open={!!deleteUser}
        title="Delete user account?"
        message={`The login "${deleteUser?.username}" (${deleteUser?.full_name}) will be permanently removed and can no longer sign in. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteUser(null)}
        onConfirm={confirmDelete}
      />

      {/* One-time temp password reveal (direct reset) */}
      <TempPasswordModal
        open={!!tempPw}
        who={tempPw?.who ?? ""}
        password={tempPw?.password ?? ""}
        onClose={() => setTempPw(null)}
      />
    </div>
  );
}
