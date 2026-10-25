// ============================================================================
// PAGE 6: Attendance Records — role aware.
//   • Admin -> date range + department + status filters + export, all staff
//   • Staff -> their OWN history, filter by month OR date range, each day marked
//     present/late/absent, PLUS a monthly summary (hours worked, late, absent)
// TODO(API):
//   GET /api/attendance?from=&to=&dept=&status=&staff_id=
//   GET /api/attendance/export?format=pdf|xlsx
// ============================================================================
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Filter, CalendarDays, Timer, Clock, UserX, UserCheck } from "lucide-react";
import { attendance, departments, staffById, deptCode, todayISO, hoursBetween, type AppUser } from "../data/mockDatabase";
import { EmptyState, StatusBadge, inputCls, labelCls } from "../components/Common";

export default function AttendanceRecords({ notify, currentUser }: { notify: (t: "success" | "error" | "info", title: string, body?: string) => void; currentUser: AppUser }) {
  const isStaff = currentUser.role === "Staff"; // staff see only their own rows

  // ---- Admin-style date range filters ----
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(todayISO());
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");

  // ---- Staff month filter (YYYY-MM). "all" = show everything ----
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));

  // Months that actually have data for this staff member (for the dropdown).
  const myMonths = useMemo(() => {
    if (!isStaff) return [];
    const set = new Set(attendance.filter((a) => a.staff_id === currentUser.staff_id).map((a) => a.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [isStaff, currentUser.staff_id]);

  // ---- Final filtered list ----
  const filtered = useMemo(() => {
    let rows = attendance.filter((a) => (isStaff ? a.staff_id === currentUser.staff_id : true));
    if (isStaff) {
      // Staff: filter by selected month (or all).
      if (month !== "all") rows = rows.filter((a) => a.date.slice(0, 7) === month);
    } else {
      // Admin: date range + dept + status.
      rows = rows
        .filter((a) => a.date >= from && a.date <= to)
        .filter((a) => { const s = staffById(a.staff_id); return dept === "all" || (s && String(s.department_id) === dept); })
        .filter((a) => status === "all" || a.status === status);
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [from, to, dept, status, month, isStaff, currentUser.staff_id]);

  // ---- Monthly summary (staff only) ----
  const summary = useMemo(() => {
    const present = filtered.filter((a) => a.status === "Present").length;
    const late = filtered.filter((a) => a.status === "Late").length;
    const absent = filtered.filter((a) => a.status === "Absent").length;
    const hours = filtered.reduce((sum, a) => sum + hoursBetween(a.check_in, a.check_out), 0);
    return { present, late, absent, hours: Math.round(hours * 10) / 10 };
  }, [filtered]);

  function exportFile(kind: "PDF" | "Excel") {
    // TODO(API): window.location.href = `/api/attendance/export?format=${kind}...`
    notify("info", `${kind} export started`, `${filtered.length} row(s) prepared.`);
  }

  const monthLabel = (m: string) => new Date(m + "-01T00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="animate-fade-up space-y-5">
      {/* ================= STAFF: monthly summary ================= */}
      {isStaff && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: "Hours Worked", value: `${summary.hours} h`, icon: Timer, note: month === "all" ? "All time" : monthLabel(month) },
            { label: "Days Present", value: summary.present, icon: UserCheck, note: "On time" },
            { label: "Late Arrivals", value: summary.late, icon: Clock, note: "After grace period" },
            { label: "Absences", value: summary.absent, icon: UserX, note: "No clock-in" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg">
                <Icon size={80} className="absolute -right-3 -bottom-3 opacity-15" />
                <p className="text-xs font-bold tracking-widest uppercase opacity-80">{c.label}</p>
                <p className="mt-2 text-3xl font-black">{c.value}</p>
                <p className="mt-1 text-xs opacity-80">{c.note}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= Filters ================= */}
      <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 flex items-center gap-2 text-xs font-extrabold tracking-widest text-slate-500 uppercase"><Filter size={14} /> Filters</p>

        {isStaff ? (
          // ---- Staff: month picker (+ export) ----
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
                <option value="all">All months</option>
                {myMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <button onClick={() => exportFile("PDF")} className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-800"><FileText size={15} /> PDF</button>
              <button onClick={() => exportFile("Excel")} className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-600"><FileSpreadsheet size={15} /> Excel</button>
              <span className="ml-auto hidden items-center gap-1.5 self-center text-xs text-slate-400 sm:flex"><CalendarDays size={13} /> Showing your own attendance</span>
            </div>
          </div>
        ) : (
          // ---- Admin: full filters ----
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div><label className={labelCls}>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Department</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}>
                <option value="all">All departments</option>
                {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                <option value="all">All statuses</option><option>Present</option><option>Late</option><option>Absent</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => exportFile("PDF")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-blue-800"><FileText size={15} /> PDF</button>
              <button onClick={() => exportFile("Excel")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-blue-600"><FileSpreadsheet size={15} /> Excel</button>
            </div>
          </div>
        )}
      </div>

      {/* ================= Table ================= */}
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-extrabold">{filtered.length} record(s) <span className="font-medium text-slate-500">• {isStaff ? (month === "all" ? "All months" : monthLabel(month)) : `${from} → ${to}`}</span></p>
          <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex"><Download size={13} /> Each day is marked present, late or absent</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-blue-700 text-[11px] tracking-widest text-white uppercase">
                <th className="px-4 py-3">Date</th>
                {!isStaff && <th className="px-4 py-3">Staff</th>}
                {!isStaff && <th className="px-4 py-3">Dept</th>}
                <th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((a) => {
                const s = staffById(a.staff_id);
                const hrs = hoursBetween(a.check_in, a.check_out);
                return (
                  <tr key={a.attendance_id} className="border-t border-blue-50 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{new Date(a.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</td>
                    {!isStaff && <td className="px-4 py-2.5"><b>{s?.full_name ?? a.staff_id}</b><span className="block text-[11px] text-slate-500">{a.staff_id}</span></td>}
                    {!isStaff && <td className="px-4 py-2.5">{s ? deptCode(s.department_id) : "—"}</td>}
                    <td className="px-4 py-2.5 font-mono">{a.check_in ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono">{a.check_out ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono">{hrs > 0 ? `${hrs} h` : "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-6"><EmptyState title="No records found" body={isStaff ? "Try a different month." : "Widen the date range or clear the filters."} /></div>}
        {filtered.length > 60 && <p className="border-t border-blue-50 px-5 py-3 text-center text-xs text-slate-400 dark:border-slate-800">Showing first 60 of {filtered.length} — refine filters to see more.</p>}
      </div>
    </div>
  );
}
