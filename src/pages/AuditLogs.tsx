// ============================================================================
// PAGE 9: Audit Logs — table of user actions with filters
// TODO(API): GET /api/audit-logs?action=&user=&search=
// ============================================================================
import { useMemo, useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { audit_logs, type AppUser } from "../data/mockDatabase";
import { EmptyState, inputCls } from "../components/Common";

// Blue-led palette for action tags.
const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  CHECK_IN: "bg-blue-200 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100",
  ADD_STAFF: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  EDIT_STAFF: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  ENROLL_BIOMETRIC: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  EXPORT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  DEACTIVATE_STAFF: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export default function AuditLogs({ currentUser }: { currentUser: AppUser }) {
  const isStaff = currentUser.role === "Staff"; // staff see only their own actions
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");

  // Staff: only rows where the log username matches their login username.
  const scoped = isStaff ? audit_logs.filter((l) => l.username === currentUser.username) : audit_logs;
  const actions = useMemo(() => ["all", ...Array.from(new Set(scoped.map((l) => l.action)))], [scoped]);

  const filtered = scoped.filter((l) => {
    const okAction = action === "all" || l.action === action;
    const okSearch = (l.details + " " + l.username).toLowerCase().includes(search.toLowerCase());
    return okAction && okSearch;
  });

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user or details…" className={inputCls + " pl-10"} />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls + " sm:w-56"}>
          {actions.map((a) => <option key={a} value={a}>{a === "all" ? "All actions" : a.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-5 py-4">
          <ScrollText size={17} className="text-blue-700" />
          <p className="text-sm font-extrabold">{filtered.length} event(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-blue-700 text-[11px] tracking-widest text-white uppercase">
                <th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.log_id} className="border-t border-slate-100 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{l.timestamp}</td>
                  <td className="px-4 py-2.5 font-bold">@{l.username}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap ${ACTION_COLORS[l.action] ?? "bg-slate-200 text-slate-700"}`}>{l.action.replace(/_/g, " ")}</span></td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-6"><EmptyState title="No logs match" body="Try clearing the search or choosing a different action." /></div>}
      </div>
      <p className="text-center text-[11px] text-slate-400">{isStaff ? "You are viewing only your own activity. Logs are immutable and can never be edited or deleted." : "Immutable trail — rows can never be edited or deleted. Administrators see all users' activity."}</p>
    </div>
  );
}
