// ============================================================================
// PAGE 8: Departments & Shifts — simple add/edit lists
// TODO(API):
//   GET/POST /api/departments   PUT /api/departments/:id
//   GET/POST /api/shifts        PUT /api/shifts/:id
// ============================================================================
import { useState } from "react";
import { Building2, Clock3, Plus, Pencil, Users, Trash2 } from "lucide-react";
import { departments as seedDepts, shifts as seedShifts, staff, type Department, type Shift } from "../data/mockDatabase";
import { Modal, ConfirmDialog, inputCls, labelCls } from "../components/Common";

export default function DepartmentsShifts({ notify }: { notify: (t: "success" | "error" | "info", title: string, body?: string) => void }) {
  const [depts, setDepts] = useState<Department[]>(seedDepts);
  const [shiftsState, setShiftsState] = useState<Shift[]>(seedShifts);

  const [deptModal, setDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [dName, setDName] = useState(""); const [dCode, setDCode] = useState(""); const [dHead, setDHead] = useState("");
  // Department the admin is about to delete (null = no confirm dialog shown).
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);

  const [shiftModal, setShiftModal] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [sName, setSName] = useState(""); const [sStart, setSStart] = useState("08:00"); const [sEnd, setSEnd] = useState("16:00"); const [sLate, setSLate] = useState("08:30");
  // Shift the admin is about to delete (null = no confirm dialog shown).
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);

  function openDept(d?: Department) {
    setEditDept(d ?? null);
    setDName(d?.name ?? ""); setDCode(d?.code ?? ""); setDHead(d?.head ?? "");
    setDeptModal(true);
  }
  function saveDept(ev: React.FormEvent) {
    ev.preventDefault();
    if (dName.trim().length < 3 || !dCode.trim()) { notify("error", "Check fields", "Name (min 3) and code are required."); return; }
    // TODO(API): POST /api/departments or PUT /api/departments/:id
    if (editDept) setDepts((p) => p.map((x) => (x.department_id === editDept.department_id ? { ...x, name: dName.trim(), code: dCode.trim().toUpperCase(), head: dHead.trim() } : x)));
    else setDepts((p) => [...p, { department_id: Math.max(...p.map((x) => x.department_id)) + 1, name: dName.trim(), code: dCode.trim().toUpperCase(), head: dHead.trim() || "TBD" }]);
    setDeptModal(false);
    notify("success", editDept ? "Department updated" : "Department added", dName);
  }

  // Remove a department. We block deletion if staff are still assigned to it,
  // because those staff records point to this department_id.
  function confirmDelete() {
    if (!deleteDept) return;
    const assigned = staff.filter((s) => s.department_id === deleteDept.department_id).length;
    if (assigned > 0) {
      notify("error", "Cannot delete department", `${assigned} staff member(s) are still assigned to ${deleteDept.name}. Reassign them first.`);
      setDeleteDept(null);
      return;
    }
    // TODO(API): DELETE /api/departments/:id
    setDepts((p) => p.filter((x) => x.department_id !== deleteDept.department_id));
    notify("success", "Department deleted", deleteDept.name);
    setDeleteDept(null);
  }

  function openShift(s?: Shift) {
    setEditShift(s ?? null);
    setSName(s?.name ?? ""); setSStart(s?.start_time ?? "08:00"); setSEnd(s?.end_time ?? "16:00"); setSLate(s?.late_after ?? "08:30");
    setShiftModal(true);
  }
  function saveShift(ev: React.FormEvent) {
    ev.preventDefault();
    if (sName.trim().length < 3) { notify("error", "Check fields", "Shift name is required."); return; }
    // TODO(API): POST /api/shifts or PUT /api/shifts/:id
    if (editShift) setShiftsState((p) => p.map((x) => (x.shift_id === editShift.shift_id ? { ...x, name: sName.trim(), start_time: sStart, end_time: sEnd, late_after: sLate } : x)));
    else setShiftsState((p) => [...p, { shift_id: Math.max(...p.map((x) => x.shift_id)) + 1, name: sName.trim(), start_time: sStart, end_time: sEnd, late_after: sLate }]);
    setShiftModal(false);
    notify("success", editShift ? "Shift updated" : "Shift added", sName);
  }

  // Remove a shift. Blocked if staff are still assigned to it.
  function confirmDeleteShift() {
    if (!deleteShift) return;
    const assigned = staff.filter((s) => s.shift_id === deleteShift.shift_id).length;
    if (assigned > 0) {
      notify("error", "Cannot delete shift", `${assigned} staff member(s) are still on ${deleteShift.name}. Reassign them first.`);
      setDeleteShift(null);
      return;
    }
    // TODO(API): DELETE /api/shifts/:id
    setShiftsState((p) => p.filter((x) => x.shift_id !== deleteShift.shift_id));
    notify("success", "Shift deleted", deleteShift.name);
    setDeleteShift(null);
  }

  return (
    <div className="animate-fade-up grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Departments */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-extrabold"><Building2 size={17} className="text-blue-700" /> Departments ({depts.length})</h3>
          <button onClick={() => openDept()} className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-blue-800"><Plus size={14} /> Add</button>
        </div>
        <div className="mt-4 space-y-3">
          {depts.map((d) => {
            const count = staff.filter((s) => s.department_id === d.department_id && s.status === "Active").length;
            return (
              <div key={d.department_id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-xs font-black text-white">{d.code.slice(0, 3)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{d.name}</p>
                  <p className="flex items-center gap-2 text-xs text-slate-500"><span className="flex items-center gap-1"><Users size={12} /> {count} staff</span> • Head: {d.head}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openDept(d)} title="Edit" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteDept(d)} title="Delete" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-red-500 hover:text-red-600 dark:border-slate-700"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shifts */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-extrabold"><Clock3 size={17} className="text-indigo-700" /> Shifts ({shiftsState.length})</h3>
          <button onClick={() => openShift()} className="flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-800"><Plus size={14} /> Add</button>
        </div>
        <div className="mt-4 space-y-3">
          {shiftsState.map((s) => (
            <div key={s.shift_id} className="rounded-2xl border border-slate-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60">
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold">{s.name}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => openShift(s)} title="Edit" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-indigo-500 hover:text-indigo-700 dark:border-slate-700"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteShift(s)} title="Delete" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-red-500 hover:text-red-600 dark:border-slate-700"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">IN {s.start_time}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">OUT {s.end_time}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">LATE AFTER {s.late_after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dept modal */}
      <Modal open={deptModal} onClose={() => setDeptModal(false)} title={editDept ? "Edit department" : "Add department"}>
        <form onSubmit={saveDept} className="space-y-4">
          <div><label className={labelCls}>Department name *</label><input value={dName} onChange={(e) => setDName(e.target.value)} className={inputCls} placeholder="e.g. Student Affairs" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Code *</label><input value={dCode} onChange={(e) => setDCode(e.target.value)} className={inputCls} placeholder="e.g. STA" /></div>
            <div><label className={labelCls}>Head of dept</label><input value={dHead} onChange={(e) => setDHead(e.target.value)} className={inputCls} placeholder="e.g. Dr. Name" /></div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeptModal(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button>
            <button className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white">Save</button>
          </div>
        </form>
      </Modal>

      {/* Shift modal */}
      <Modal open={shiftModal} onClose={() => setShiftModal(false)} title={editShift ? "Edit shift" : "Add shift"}>
        <form onSubmit={saveShift} className="space-y-4">
          <div><label className={labelCls}>Shift name *</label><input value={sName} onChange={(e) => setSName(e.target.value)} className={inputCls} placeholder="e.g. Weekend Duty" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Start</label><input type="time" value={sStart} onChange={(e) => setSStart(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>End</label><input type="time" value={sEnd} onChange={(e) => setSEnd(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Late after</label><input type="time" value={sLate} onChange={(e) => setSLate(e.target.value)} className={inputCls} /></div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShiftModal(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button>
            <button className="flex-1 rounded-xl bg-indigo-700 py-2.5 text-sm font-extrabold text-white">Save</button>
          </div>
        </form>
      </Modal>

      {/* Delete department confirmation */}
      <ConfirmDialog
        open={!!deleteDept}
        title="Delete department?"
        message={`This will permanently remove "${deleteDept?.name}". This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteDept(null)}
        onConfirm={confirmDelete}
      />

      {/* Delete shift confirmation */}
      <ConfirmDialog
        open={!!deleteShift}
        title="Delete shift?"
        message={`This will permanently remove "${deleteShift?.name}". This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteShift(null)}
        onConfirm={confirmDeleteShift}
      />
    </div>
  );
}
