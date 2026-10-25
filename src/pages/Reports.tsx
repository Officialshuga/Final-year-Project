// ============================================================================
// PAGE 7: Reports — role aware.
//   • Admin -> daily / weekly / monthly org analytics, late, absentees, dept
//   • Staff -> THEIR OWN personal report (attendance rate, late/absent, trend)
// TODO(API):
//   Admin: GET /api/reports/daily|weekly|monthly
//   Staff: GET /api/staff/:id/report
// ============================================================================
import { useMemo, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { CalendarDays, Clock, UserX, Building2, UserCheck } from "lucide-react";
import { attendance, staff, departments, staffById, deptCode, deptName, todayISO, type AppUser } from "../data/mockDatabase";
import { StatusBadge, EmptyState } from "../components/Common";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

type Tab = "daily" | "weekly" | "monthly";

export default function Reports({ currentUser }: { currentUser: AppUser }) {
  const [tab, setTab] = useState<Tab>("daily");
  const today = todayISO();
  const isStaff = currentUser.role === "Staff";

  const last14 = useMemo(() => {
    const arr: string[] = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); arr.push(d.toISOString().slice(0, 10)); }
    return arr;
  }, []);
  const last7 = last14.slice(7);

  // ==========================================================================
  // STAFF personal report
  // ==========================================================================
  if (isStaff) {
    const me = currentUser.staff_id ? staffById(currentUser.staff_id) : undefined;
    const myRows = attendance.filter((a) => a.staff_id === currentUser.staff_id);
    const present = myRows.filter((a) => a.status === "Present").length;
    const late = myRows.filter((a) => a.status === "Late").length;
    const absent = myRows.filter((a) => a.status === "Absent").length;
    const total = myRows.length || 1;
    const rate = Math.round(((present + late) / total) * 100);

    return (
      <div className="animate-fade-up space-y-5">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-black">My personal attendance report</h3>
          <p className="text-xs text-slate-500">{me ? `${me.full_name} • ${deptName(me.department_id)} • ${me.role_title}` : "Staff account"}</p>
        </div>

        {/* summary cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: "Attendance Rate", value: `${rate}%`, icon: UserCheck },
            { label: "Days Present", value: present, icon: CalendarDays },
            { label: "Times Late", value: late, icon: Clock },
            { label: "Absences", value: absent, icon: UserX },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg">
                <Icon size={80} className="absolute -right-3 -bottom-3 opacity-15" />
                <p className="text-xs font-bold tracking-widest uppercase opacity-80">{c.label}</p>
                <p className="mt-2 text-3xl font-black">{c.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-extrabold">My attendance split</h3>
            <div className="mt-4 h-[260px]">
              <Doughnut data={{ labels: ["Present", "Late", "Absent"], datasets: [{ data: [present, late, absent], backgroundColor: ["#1d4ed8", "#60a5fa", "#cbd5e1"] }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-extrabold">My 14-day trend</h3>
            <div className="mt-4 h-[260px]">
              <Line data={{
                labels: last14.map((d) => new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })),
                datasets: [{ label: "Present=1, Late=0.5, Absent=0", data: last14.map((d) => { const r = myRows.find((a) => a.date === d); return r ? (r.status === "Present" ? 1 : r.status === "Late" ? 0.5 : 0) : 0; }), borderColor: "#1d4ed8", backgroundColor: "rgba(29,78,216,0.15)", fill: true, tension: 0.4, pointRadius: 3 }],
              }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 1, ticks: { stepSize: 0.5 } } } }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-extrabold">My attendance history</h3>
          {myRows.length === 0 ? <div className="mt-3"><EmptyState title="No records yet" body="Your attendance will show here." /></div> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead><tr className="bg-blue-700 text-[11px] tracking-widest text-white uppercase"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Status</th></tr></thead>
                <tbody>
                  {[...myRows].reverse().slice(0, 20).map((r) => (
                    <tr key={r.attendance_id} className="border-t border-blue-50 dark:border-slate-800">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.date}</td>
                      <td className="px-4 py-2.5 font-mono">{r.check_in ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono">{r.check_out ?? "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // ADMIN org analytics (confidential)
  // ==========================================================================
  const todayRows = attendance.filter((a) => a.date === today);
  const lateList = todayRows.filter((r) => r.status === "Late");
  const absentList = todayRows.filter((r) => r.status === "Absent");

  const deptSummary = departments.map((d) => {
    const ids = staff.filter((s) => s.department_id === d.department_id && s.status === "Active").map((s) => s.staff_id);
    const rows = todayRows.filter((r) => ids.includes(r.staff_id));
    const present = rows.filter((r) => r.status !== "Absent").length;
    return { code: d.code, name: d.name, total: ids.length, present, rate: ids.length ? Math.round((present / ids.length) * 100) : 0 };
  });

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        🔒 Confidential — organisation-wide analytics (Administrator access only)
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-blue-100 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {(["daily", "weekly", "monthly"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold capitalize transition ${tab === t ? "bg-blue-700 text-white shadow-lg" : "text-slate-500 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            <CalendarDays size={15} /> {t}
          </button>
        ))}
        <span className="ml-auto hidden items-center px-3 text-xs text-slate-400 sm:flex">Charts powered by Chart.js</span>
      </div>

      {tab === "daily" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 font-extrabold"><Clock size={16} className="text-blue-600" /> Late arrivals today ({lateList.length})</h3>
            {lateList.length === 0 ? <div className="mt-3"><EmptyState title="No late arrivals" body="Everyone beat the grace period today." /></div> : (
              <ul className="mt-3 space-y-2">
                {lateList.map((r) => { const s = staffById(r.staff_id); return <li key={r.attendance_id} className="flex items-center justify-between rounded-xl bg-blue-50/60 px-4 py-2.5 text-sm dark:bg-slate-800/60"><span><b>{s?.full_name}</b> <span className="text-xs text-slate-500">• {s ? deptCode(s.department_id) : ""} • in {r.check_in}</span></span><StatusBadge status="Late" /></li>; })}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 font-extrabold"><UserX size={16} className="text-slate-600" /> Absentees today ({absentList.length})</h3>
            {absentList.length === 0 ? <div className="mt-3"><EmptyState title="Full house!" body="No absences recorded today." /></div> : (
              <ul className="mt-3 space-y-2">
                {absentList.map((r) => { const s = staffById(r.staff_id); return <li key={r.attendance_id} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2.5 text-sm dark:bg-slate-800/60"><span><b>{s?.full_name}</b> <span className="text-xs text-slate-500">• {s ? deptCode(s.department_id) : ""}</span></span><StatusBadge status="Absent" /></li>; })}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-5 xl:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 font-extrabold"><Building2 size={16} className="text-blue-700" /> Department summary — today</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="h-[240px]"><Doughnut data={{ labels: deptSummary.map((d) => d.code), datasets: [{ data: deptSummary.map((d) => d.present), backgroundColor: ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"] }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } }} /></div>
              <div className="space-y-2">
                {deptSummary.map((d) => (
                  <div key={d.code} className="rounded-xl bg-blue-50/60 p-3 dark:bg-slate-800/60">
                    <div className="flex justify-between text-sm"><b>{d.code}</b><span className="text-xs text-slate-500">{d.present}/{d.total} present • {d.rate}%</span></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-600" style={{ width: `${d.rate}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "weekly" && (
        <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-extrabold">Weekly overview — last 7 days</h3>
          <p className="text-xs text-slate-500">Stacked attendance per day</p>
          <div className="mt-4 h-[320px]">
            <Bar data={{
              labels: last7.map((d) => new Date(d + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })),
              datasets: [
                { label: "Present", data: last7.map((d) => attendance.filter((a) => a.date === d && a.status === "Present").length), backgroundColor: "#1d4ed8", borderRadius: 6 },
                { label: "Late", data: last7.map((d) => attendance.filter((a) => a.date === d && a.status === "Late").length), backgroundColor: "#60a5fa", borderRadius: 6 },
                { label: "Absent", data: last7.map((d) => attendance.filter((a) => a.date === d && a.status === "Absent").length), backgroundColor: "#cbd5e1", borderRadius: 6 },
              ],
            }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }} />
          </div>
        </div>
      )}

      {tab === "monthly" && (
        <div className="rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-extrabold">Monthly trend — last 14 days</h3>
          <p className="text-xs text-slate-500">Daily present-rate %</p>
          <div className="mt-4 h-[320px]">
            <Line data={{
              labels: last14.map((d) => new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })),
              datasets: [{ label: "Present %", data: last14.map((d) => { const rows = attendance.filter((a) => a.date === d); const p = rows.filter((a) => a.status === "Present").length; return rows.length ? Math.round((p / rows.length) * 100) : 0; }), borderColor: "#1d4ed8", backgroundColor: "rgba(29,78,216,0.15)", fill: true, tension: 0.4, pointRadius: 3 }],
            }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } } }} />
          </div>
        </div>
      )}
    </div>
  );
}
