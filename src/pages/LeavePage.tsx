// ============================================================================
// PAGE: Leave Requests
//   • Staff: submit a leave request, see their own history, cancel pending ones
//   • Admin: see ALL requests, approve or reject pending ones
// TODO(API): see src/data/leaveRequests.ts for the endpoint mapping.
// ============================================================================
import { useState } from "react";
import { CalendarPlus, Check, X, Trash2, Plane } from "lucide-react";
import {
  getLeaveFor, addLeaveRequest, setLeaveStatus, cancelLeaveRequest, leaveDays,
  type LeaveRequest,
} from "../data/leaveRequests";
import { staffById, deptName, type AppUser } from "../data/mockDatabase";
import { Modal, ConfirmDialog, EmptyState, inputCls, labelCls } from "../components/Common";

const LEAVE_TYPES = ["Annual", "Sick", "Casual", "Study", "Other"];

export default function LeavePage({ notify, currentUser }: {
  notify: (t: "success" | "error" | "info", title: string, body?: string) => void;
  currentUser: AppUser;
}) {
  const isStaff = currentUser.role === "Staff";
  const me = currentUser.staff_id ? staffById(currentUser.staff_id) : undefined;

  // Staff see only their own; admin sees all.
  const [rows, setRows] = useState<LeaveRequest[]>(
    getLeaveFor(isStaff ? currentUser.staff_id : undefined)
  );
  const refresh = () => setRows(getLeaveFor(isStaff ? currentUser.staff_id : undefined));

  // ---- Submit modal (staff) ----
  const [open, setOpen] = useState(false);
  const [lType, setLType] = useState("Annual");
  const [lStart, setLStart] = useState("");
  const [lEnd, setLEnd] = useState("");
  const [lReason, setLReason] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!lStart || !lEnd) { notify("error", "Pick dates", "Start and end dates are required."); return; }
    if (lEnd < lStart) { notify("error", "Invalid range", "End date cannot be before start date."); return; }
    if (!currentUser.staff_id) { notify("error", "No staff record", "Your login isn't linked to a staff record."); return; }
    // TODO(API): POST /api/leave
    addLeaveRequest({
      staff_id: currentUser.staff_id,
      staff_name: currentUser.full_name,
      leave_type: lType, start_date: lStart, end_date: lEnd, reason: lReason.trim(),
    });
    refresh();
    setOpen(false);
    setLStart(""); setLEnd(""); setLReason(""); setLType("Annual");
    notify("success", "Leave requested", "Your request was submitted for approval.");
  }

  function approve(l: LeaveRequest) {
    setLeaveStatus(l.id, "approved", currentUser.username);
    refresh();
    notify("success", "Leave approved", `${l.staff_name}'s ${l.leave_type} leave approved.`);
  }
  function reject(l: LeaveRequest) {
    setLeaveStatus(l.id, "rejected", currentUser.username);
    refresh();
    notify("info", "Leave rejected", `${l.staff_name}'s request was rejected.`);
  }
  function doCancel() {
    if (cancelId == null) return;
    cancelLeaveRequest(cancelId);
    refresh();
    setCancelId(null);
    notify("info", "Request cancelled", "Your leave request was removed.");
  }

  const pill = (s: LeaveRequest["status"]) =>
    s === "pending" ? "bg-amber-100 text-amber-800"
    : s === "approved" ? "bg-blue-100 text-blue-700"
    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  return (
    <div className="animate-fade-up space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white"><Plane size={20} /></span>
          <div>
            <h3 className="font-extrabold">{isStaff ? "My leave requests" : "All leave requests"}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isStaff
                ? (me ? `${deptName(me.department_id)} • ${me.role_title}` : "Staff account")
                : "Approve or reject staff leave"}
            </p>
          </div>
        </div>
        {isStaff && (
          <button onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">
            <CalendarPlus size={16} /> Request leave
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No leave requests" body={isStaff ? "Submit a request using the button above." : "Staff leave requests will appear here."} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="bg-blue-700 text-[11px] tracking-widest text-white uppercase">
                  {!isStaff && <th className="px-4 py-3">Staff</th>}
                  <th className="px-4 py-3">Type</th><th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th><th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-t border-blue-50 dark:border-slate-800">
                    {!isStaff && <td className="px-4 py-3 font-bold">{l.staff_name}<span className="block text-[11px] font-normal text-slate-500">{l.staff_id}</span></td>}
                    <td className="px-4 py-3">{l.leave_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">{l.start_date}</td>
                    <td className="px-4 py-3 font-mono text-xs">{l.end_date}</td>
                    <td className="px-4 py-3 font-bold">{leaveDays(l.start_date, l.end_date)}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate text-slate-500" title={l.reason}>{l.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${pill(l.status)}`}>{l.status.toUpperCase()}</span>
                      {l.status !== "pending" && l.handled_by && (
                        <span className="mt-1 block text-[10px] text-slate-400">by {l.handled_by}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {/* Admin actions on pending */}
                        {!isStaff && l.status === "pending" && (
                          <>
                            <button onClick={() => approve(l)} className="flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800"><Check size={13} /> Approve</button>
                            <button onClick={() => reject(l)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-red-400 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"><X size={13} /> Reject</button>
                          </>
                        )}
                        {/* Staff can cancel their own pending request */}
                        {isStaff && l.status === "pending" && (
                          <button onClick={() => setCancelId(l.id)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-red-400 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"><Trash2 size={13} /> Cancel</button>
                        )}
                        {l.status !== "pending" && <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Request leave" subtitle="Fill in the details for your leave">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Leave type</label>
            <select value={lType} onChange={(e) => setLType(e.target.value)} className={inputCls}>
              {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>From</label><input type="date" value={lStart} onChange={(e) => setLStart(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>To</label><input type="date" value={lEnd} onChange={(e) => setLEnd(e.target.value)} className={inputCls} /></div>
          </div>
          {lStart && lEnd && lEnd >= lStart && (
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{leaveDays(lStart, lEnd)} day(s) requested</p>
          )}
          <div>
            <label className={labelCls}>Reason <span className="font-normal normal-case text-slate-400">(optional)</span></label>
            <textarea value={lReason} onChange={(e) => setLReason(e.target.value)} rows={3} maxLength={200} className={inputCls} placeholder="Add any detail for the approver…" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button>
            <button className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">Submit request</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={cancelId !== null}
        title="Cancel this request?"
        message="Your pending leave request will be removed."
        confirmLabel="Cancel request"
        onCancel={() => setCancelId(null)}
        onConfirm={doCancel}
      />
    </div>
  );
}
