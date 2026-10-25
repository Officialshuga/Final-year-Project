// ============================================================================
// PAGE: Password Requests (ADMIN ONLY)
// Lists password-reset requests submitted from the login "Forgot password?"
// link. Admin can Reset (generate a temp password) or Reject each pending one.
// TODO(API):
//   GET   /api/password-requests
//   PATCH /api/password-requests/:id/reset   -> backend returns temp password
//   PATCH /api/password-requests/:id/reject
// ============================================================================
import { useState } from "react";
import { KeyRound, X, ShieldCheck } from "lucide-react";
import { getResetRequests, resolveRequest, type ResetRequest } from "../data/resetRequests";
import { generateTempPassword } from "../utils/password";
import { EmptyState, ConfirmDialog } from "../components/Common";
import TempPasswordModal from "../components/TempPasswordModal";
import type { AppUser } from "../data/mockDatabase";

export default function PasswordRequests({ notify, currentUser }: {
  notify: (t: "success" | "error" | "info", title: string, body?: string) => void;
  currentUser: AppUser;
}) {
  const [reqs, setReqs] = useState<ResetRequest[]>(getResetRequests());
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "rejected">("pending");
  const [reject, setReject] = useState<ResetRequest | null>(null);
  const [tempPw, setTempPw] = useState<{ who: string; password: string } | null>(null);

  const shown = reqs.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = reqs.filter((r) => r.status === "pending").length;

  function doReset(r: ResetRequest) {
    // Generate a strong temp password and show it ONCE to the admin.
    // TODO(API): PATCH /api/password-requests/:id/reset -> backend hashes it,
    // sets must_change_password, expires in 24h, invalidates sessions, returns
    // the plain temp password ONCE for display.
    const temp = generateTempPassword(12);
    resolveRequest(r.id, "completed", currentUser.username);
    setReqs(getResetRequests());
    setTempPw({ who: `${r.full_name} (${r.staff_id})`, password: temp });
    notify("success", "Password reset", `A temporary password was generated for ${r.staff_id}.`);
  }

  function doReject(r: ResetRequest) {
    resolveRequest(r.id, "rejected", currentUser.username);
    setReqs(getResetRequests());
    setReject(null);
    notify("info", "Request rejected", `Reset request for ${r.staff_id} was rejected.`);
  }

  const statusPill = (s: ResetRequest["status"]) =>
    s === "pending" ? "bg-amber-100 text-amber-800"
    : s === "completed" ? "bg-blue-100 text-blue-700"
    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  return (
    <div className="animate-fade-up space-y-5">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {(["pending", "completed", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold capitalize transition ${filter === f ? "bg-blue-700 text-white shadow-lg" : "text-slate-500 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-black ${filter === "pending" ? "bg-white text-blue-700" : "bg-blue-600 text-white"}`}>{pendingCount}</span>
            )}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1.5 px-2 text-xs text-slate-400 sm:flex">
          <ShieldCheck size={13} /> Hand temp passwords over securely, in person
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {shown.length === 0 ? (
          <div className="p-6"><EmptyState title="No requests here" body="When staff use 'Forgot password?' on the login page, their requests appear here." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="bg-blue-700 text-[11px] tracking-widest text-white uppercase">
                  <th className="px-4 py-3">Staff</th><th className="px-4 py-3">Staff ID</th>
                  <th className="px-4 py-3">Department</th><th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-blue-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-bold">{r.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.staff_id}</td>
                    <td className="px-4 py-3 text-slate-500">{r.department}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-500" title={r.message}>{r.message || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{r.requested_at}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${statusPill(r.status)}`}>{r.status.toUpperCase()}</span>
                      {r.status !== "pending" && r.handled_by && (
                        <span className="mt-1 block text-[10px] text-slate-400">by {r.handled_by} • {r.handled_at}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => doReset(r)} className="flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800"><KeyRound size={13} /> Reset</button>
                          <button onClick={() => setReject(r)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-red-400 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"><X size={13} /> Reject</button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject confirm */}
      <ConfirmDialog
        open={!!reject}
        title="Reject this request?"
        message={`The password reset request for ${reject?.staff_id} will be marked rejected.`}
        confirmLabel="Reject"
        onCancel={() => setReject(null)}
        onConfirm={() => reject && doReject(reject)}
      />

      {/* One-time temp password reveal */}
      <TempPasswordModal
        open={!!tempPw}
        who={tempPw?.who ?? ""}
        password={tempPw?.password ?? ""}
        onClose={() => setTempPw(null)}
      />
    </div>
  );
}
