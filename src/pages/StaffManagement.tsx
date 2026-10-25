// ============================================================================
// PAGE 3: Staff Management — table + search + dept filter + pagination
//         + add/edit modal + deactivate (with confirm dialog)
// TODO(API):
//   GET    /api/staff?search=&dept=&page=
//   POST   /api/staff
//   PUT    /api/staff/:id
//   PATCH  /api/staff/:id/deactivate
// ============================================================================
import { useMemo, useState } from "react";
import { Search, Plus, Pencil, UserX, UserCheck, ChevronLeft, ChevronRight, Fingerprint, Trash2 } from "lucide-react";
import { staff as seedStaff, departments, shifts, deptName, shiftName, type StaffMember } from "../data/mockDatabase";
import { Modal, ConfirmDialog, EmptyState, StatusBadge, inputCls, labelCls } from "../components/Common";

const PAGE_SIZE = 6; // rows per page — small so pagination is visible in demo

export default function StaffManagement({ notify }: { notify: (t: "success" | "error" | "info", title: string, body?: string) => void }) {
  // ---- Local copy of staff so add/edit/deactivate feel real (useState) ----
  // TODO(API): replace with server data: const [staff, setStaff] = useState([]); useEffect(fetch...)
  const [rows, setRows] = useState<StaffMember[]>(seedStaff);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // ---- Modal + confirm state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [confirm, setConfirm] = useState<StaffMember | null>(null);        // deactivate confirm
  const [deleteStaff, setDeleteStaff] = useState<StaffMember | null>(null); // permanent delete confirm

  // ---- Form fields ----
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fDept, setFDept] = useState(1);
  const [fShift, setFShift] = useState(1);
  const [fTitle, setFTitle] = useState("");
  const [fErrors, setFErrors] = useState<Record<string, string>>({});

  // ---- Filtering (search + department) ----
  const filtered = useMemo(() => {
    return rows.filter((s) => {
      const hit = (s.full_name + " " + s.staff_id + " " + s.email).toLowerCase().includes(search.toLowerCase());
      const deptOk = deptFilter === "all" || String(s.department_id) === deptFilter;
      return hit && deptOk;
    });
  }, [rows, search, deptFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openAdd() {
    setEditing(null);
    setFName(""); setFEmail(""); setFPhone(""); setFDept(1); setFShift(1); setFTitle(""); setFErrors({});
    setModalOpen(true);
  }
  function openEdit(s: StaffMember) {
    setEditing(s);
    setFName(s.full_name); setFEmail(s.email); setFPhone(s.phone);
    setFDept(s.department_id); setFShift(s.shift_id); setFTitle(s.role_title); setFErrors({});
    setModalOpen(true);
  }

  function saveStaff(ev: React.FormEvent) {
    ev.preventDefault();
    // ---- Basic validation ----
    const e: Record<string, string> = {};
    if (fName.trim().length < 3) e.name = "Full name is required (min 3 chars).";
    if (!/^\S+@\S+\.\S+$/.test(fEmail)) e.email = "Enter a valid email address.";
    if (fPhone.trim().length < 7) e.phone = "Enter a valid phone number.";
    if (!fTitle.trim()) e.title = "Job title is required.";
    setFErrors(e);
    if (Object.keys(e).length) return;

    if (editing) {
      // TODO(API): await fetch(`/api/staff/${editing.staff_id}`, { method:'PUT', body:... })
      setRows((prev) => prev.map((r) => (r.staff_id === editing.staff_id ? { ...r, full_name: fName.trim(), email: fEmail.trim(), phone: fPhone.trim(), department_id: fDept, shift_id: fShift, role_title: fTitle.trim() } : r)));
      notify("success", "Staff updated", `${fName} was saved.`);
    } else {
      // TODO(API): await fetch('/api/staff', { method:'POST', body:... })
      const newId = `GVU/2026/${String(Math.floor(100 + Math.random() * 900))}`;
      setRows((prev) => [...prev, { staff_id: newId, full_name: fName.trim(), email: fEmail.trim(), phone: fPhone.trim(), department_id: fDept, shift_id: fShift, role_title: fTitle.trim(), status: "Active", enrolled: false, avatar_color: "from-blue-500 to-indigo-600", date_joined: new Date().toISOString().slice(0, 10) }]);
      notify("success", "Staff added", `${fName} (${newId}) created.`);
    }
    setModalOpen(false);
  }

  function toggleActive(s: StaffMember) {
    // TODO(API): PATCH /api/staff/:id/deactivate
    setRows((prev) => prev.map((r) => (r.staff_id === s.staff_id ? { ...r, status: r.status === "Active" ? "Inactive" : "Active" } : r)));
    setConfirm(null);
    notify("info", s.status === "Active" ? "Staff deactivated" : "Staff reactivated", s.full_name);
  }

  // Permanently remove a staff record (different from deactivate).
  function confirmDelete() {
    if (!deleteStaff) return;
    // TODO(API): DELETE /api/staff/:id
    setRows((prev) => prev.filter((r) => r.staff_id !== deleteStaff.staff_id));
    notify("success", "Staff deleted", `${deleteStaff.full_name} was permanently removed.`);
    setDeleteStaff(null);
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, ID or email…" className={inputCls + " pl-10"} />
        </div>
        <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }} className={inputCls + " lg:w-60"}>
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
        </select>
        <button onClick={openAdd} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="bg-blue-700 text-[11px] tracking-widest text-white uppercase">
                <th className="px-4 py-3">Staff</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Fingerprint</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => (
                <tr key={s.staff_id} className="border-t border-slate-100 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.avatar_color} text-xs font-black text-white`}>
                        {s.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <span>
                        <span className="block font-extrabold text-slate-900 dark:text-white">{s.full_name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{s.staff_id} • {s.role_title}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{deptName(s.department_id)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{shiftName(s.shift_id)}</td>
                  <td className="px-4 py-3">
                    {s.enrolled
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-extrabold text-blue-700"><Fingerprint size={12} /> ENROLLED</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 dark:bg-slate-700 dark:text-slate-300">NOT ENROLLED</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(s)} title="Edit" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700"><Pencil size={15} /></button>
                      {s.status === "Active"
                        ? <button onClick={() => setConfirm(s)} title="Deactivate" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-slate-500 hover:text-slate-700 dark:border-slate-700"><UserX size={15} /></button>
                        : <button onClick={() => toggleActive(s)} title="Reactivate" className="rounded-lg border border-slate-200 p-2 text-blue-600 hover:border-blue-500 dark:border-slate-700"><UserCheck size={15} /></button>}
                      <button onClick={() => setDeleteStaff(s)} title="Delete" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-red-500 hover:text-red-600 dark:border-slate-700"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-6"><EmptyState title="No staff found" body="Try a different search term or department filter — or add a new staff member." action={<button onClick={openAdd} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Add staff</button>} /></div>
        )}

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Showing <b>{pageRows.length}</b> of <b>{filtered.length}</b> staff • Page <b>{safePage}</b> of <b>{pages}</b></p>
          <div className="flex items-center gap-2">
            <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 dark:border-slate-700"><ChevronLeft size={14} /> Prev</button>
            {Array.from({ length: pages }).slice(0, 5).map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`h-8 w-8 rounded-lg text-xs font-black ${safePage === i + 1 ? "bg-blue-700 text-white" : "border border-slate-200 dark:border-slate-700"}`}>{i + 1}</button>
            ))}
            <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 dark:border-slate-700">Next <ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.full_name}` : "Add new staff"} subtitle="Fields marked * are required" wide>
        <form onSubmit={saveStaff} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Full name *</label>
            <input value={fName} onChange={(e) => setFName(e.target.value)} className={inputCls} placeholder="e.g. Mary Johnson" />
            {fErrors.name && <p className="mt-1 text-xs font-semibold text-red-600">{fErrors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className={inputCls} placeholder="name@gvu.edu" />
            {fErrors.email && <p className="mt-1 text-xs font-semibold text-red-600">{fErrors.email}</p>}
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className={inputCls} placeholder="0803 ..." />
            {fErrors.phone && <p className="mt-1 text-xs font-semibold text-red-600">{fErrors.phone}</p>}
          </div>
          <div>
            <label className={labelCls}>Department</label>
            <select value={fDept} onChange={(e) => setFDept(Number(e.target.value))} className={inputCls}>
              {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Shift</label>
            <select value={fShift} onChange={(e) => setFShift(Number(e.target.value))} className={inputCls}>
              {shifts.map((s) => <option key={s.shift_id} value={s.shift_id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Job title *</label>
            <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} className={inputCls} placeholder="e.g. Lecturer II" />
            {fErrors.title && <p className="mt-1 text-xs font-semibold text-red-600">{fErrors.title}</p>}
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button>
            <button type="submit" className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">{editing ? "Save changes" : "Add staff"}</button>
          </div>
        </form>
      </Modal>

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!confirm} title="Deactivate staff?"
        message={`${confirm?.full_name} will no longer be able to clock in. You can reactivate them later.`}
        confirmLabel="Deactivate"
        onCancel={() => setConfirm(null)} onConfirm={() => confirm && toggleActive(confirm)}
      />

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={!!deleteStaff} title="Delete staff permanently?"
        message={`${deleteStaff?.full_name} and their link to attendance will be removed. This cannot be undone. Consider deactivating instead if unsure.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteStaff(null)} onConfirm={confirmDelete}
      />
    </div>
  );
}
