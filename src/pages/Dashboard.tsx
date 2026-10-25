// ============================================================================
// PAGE 2: Dashboard — role aware.
//   • Admin -> organisation-wide cards, weekly chart, recent activity
//   • Staff -> their OWN attendance summary + personal weekly chart
// TODO(API):
//   Admin: GET /api/dashboard/summary, GET /api/attendance/weekly
//   Staff: GET /api/staff/:id/summary, GET /api/staff/:id/attendance/weekly
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { Users, UserCheck, Clock, UserX, TrendingUp, Fingerprint, CalendarCheck, LogIn, LogOut, Timer } from "lucide-react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import { staff, attendance, audit_logs, todayISO, deptCode, deptName, staffById, hoursBetween, type AppUser } from "../data/mockDatabase";
import { LoadingRows, EmptyState, StatusBadge } from "../components/Common";
import GvuLogo from "../components/GvuLogo";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Dashboard({ onGo, currentUser }: { onGo: (p: any) => void; currentUser: AppUser }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const isStaff = currentUser.role === "Staff";
  const today = todayISO();

  // Last 7 days list
  const last7 = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(new Date().getDate() - i); days.push(d.toISOString().slice(0, 10)); }
    return days;
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <LoadingRows rows={6} />
      </div>
    );
  }

  // ==========================================================================
  // STAFF personal dashboard
  // ==========================================================================
  if (isStaff) {
    const me = currentUser.staff_id ? staffById(currentUser.staff_id) : undefined;
    const myRows = attendance.filter((a) => a.staff_id === currentUser.staff_id);
    const myToday = myRows.find((a) => a.date === today);
    const present = myRows.filter((a) => a.status === "Present").length;
    const late = myRows.filter((a) => a.status === "Late").length;
    const absent = myRows.filter((a) => a.status === "Absent").length;
    const totalDays = myRows.length || 1;
    const rate = Math.round(((present + late) / totalDays) * 100);

    const cards = [
      { label: "Today's Status", value: myToday ? myToday.status : "—", icon: CalendarCheck, note: myToday?.check_in ? `Clocked in ${myToday.check_in}` : "No record yet" },
      { label: "Days Present", value: present, icon: UserCheck, note: "Last 14 days" },
      { label: "Times Late", value: late, icon: Clock, note: "Last 14 days" },
      { label: "Attendance Rate", value: `${rate}%`, icon: TrendingUp, note: `${absent} absence(s)` },
    ];

    const myChart = {
      labels: last7.map((d) => new Date(d + "T00:00").toLocaleDateString("en-GB", { weekday: "short" })),
      datasets: [{
        label: "My check-in (1=Present, 0.5=Late, 0=Absent)",
        data: last7.map((d) => { const r = myRows.find((a) => a.date === d); return r ? (r.status === "Present" ? 1 : r.status === "Late" ? 0.5 : 0) : 0; }),
        backgroundColor: "#1d4ed8", borderRadius: 6, barPercentage: 0.6,
      }],
    };

    return (
      <div className="animate-fade-up space-y-6">
        {/* Personal welcome */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-blue-900 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="hidden rounded-2xl bg-white/15 p-1 ring-1 ring-white/25 sm:block"><GvuLogo size={54} showText={false} /></span>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-blue-200 uppercase">My Attendance • Glorious Vision University</p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">Welcome, {currentUser.full_name.split(" ")[0]}</h2>
              <p className="mt-1 text-sm text-blue-100">{me ? `${deptName(me.department_id)} • ${me.role_title}` : "Staff account"} • {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
        </div>

        {/* TODAY'S STATUS — clock-in / clock-out / hours */}
        <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-extrabold"><CalendarCheck size={18} className="text-blue-700" /> Today's status</h3>
            {myToday
              ? <StatusBadge status={myToday.status} />
              : <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-600 dark:bg-slate-700 dark:text-slate-300">NO RECORD</span>}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Clock in */}
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50/60 p-4 dark:bg-slate-800/60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><LogIn size={18} /></span>
              <div>
                <p className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase dark:text-slate-400">Clock-in</p>
                <p className="font-mono text-xl font-black text-slate-800 dark:text-white">{myToday?.check_in ?? "—:—"}</p>
              </div>
            </div>
            {/* Clock out */}
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50/60 p-4 dark:bg-slate-800/60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><LogOut size={18} /></span>
              <div>
                <p className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase dark:text-slate-400">Clock-out</p>
                <p className="font-mono text-xl font-black text-slate-800 dark:text-white">{myToday?.check_out ?? (myToday?.check_in ? "Still in" : "—:—")}</p>
              </div>
            </div>
            {/* Hours today */}
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50/60 p-4 dark:bg-slate-800/60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white"><Timer size={18} /></span>
              <div>
                <p className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase dark:text-slate-400">Hours today</p>
                <p className="font-mono text-xl font-black text-slate-800 dark:text-white">{myToday?.check_out ? `${hoursBetween(myToday.check_in, myToday.check_out)} h` : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Personal cards (all blue) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg">
                <Icon size={90} className="absolute -right-4 -bottom-4 opacity-15" />
                <p className="text-xs font-bold tracking-widest uppercase opacity-80">{c.label}</p>
                <p className="mt-2 text-3xl font-black">{c.value}</p>
                <p className="mt-1 text-xs opacity-80">{c.note}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm xl:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-extrabold text-slate-900 dark:text-white">My weekly attendance</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Last 7 days</p>
            <div className="mt-4 h-[280px]"><Bar data={myChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 1, ticks: { stepSize: 0.5 } } } }} /></div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-extrabold text-slate-900 dark:text-white">My recent days</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latest check-ins</p>
            {myRows.length === 0 ? <div className="mt-4"><EmptyState title="No attendance yet" body="Your clock-ins will appear here." /></div> : (
              <ul className="mt-4 space-y-2">
                {[...myRows].reverse().slice(0, 6).map((r) => (
                  <li key={r.attendance_id} className="flex items-center justify-between rounded-xl bg-blue-50/60 px-4 py-2.5 text-sm dark:bg-slate-800/60">
                    <span><b className="font-mono text-xs">{r.date}</b> <span className="text-xs text-slate-500">• {r.check_in ?? "—"}</span></span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // ADMIN organisation dashboard
  // ==========================================================================
  const todayRows = attendance.filter((a) => a.date === today);
  const total = staff.filter((s) => s.status === "Active").length;
  const present = todayRows.filter((r) => r.status === "Present").length;
  const late = todayRows.filter((r) => r.status === "Late").length;
  const absent = todayRows.filter((r) => r.status === "Absent").length;

  const chartData = {
    labels: last7.map((d) => new Date(d + "T00:00").toLocaleDateString("en-GB", { weekday: "short" })),
    datasets: [
      { label: "Present", data: last7.map((d) => attendance.filter((a) => a.date === d && a.status === "Present").length), backgroundColor: "#1d4ed8", borderRadius: 6, barPercentage: 0.6 },
      { label: "Late", data: last7.map((d) => attendance.filter((a) => a.date === d && a.status === "Late").length), backgroundColor: "#60a5fa", borderRadius: 6, barPercentage: 0.6 },
      { label: "Absent", data: last7.map((d) => attendance.filter((a) => a.date === d && a.status === "Absent").length), backgroundColor: "#cbd5e1", borderRadius: 6, barPercentage: 0.6 },
    ],
  };

  const cards = [
    { label: "Total Staff", value: total, icon: Users, note: "Active contracts" },
    { label: "Present Today", value: present, icon: UserCheck, note: `${((present / Math.max(total, 1)) * 100).toFixed(0)}% attendance` },
    { label: "Late Today", value: late, icon: Clock, note: "Arrived after grace" },
    { label: "Absent Today", value: absent, icon: UserX, note: "No clock-in found" },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-blue-900 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <span className="hidden rounded-2xl bg-white/15 p-1 ring-1 ring-white/25 sm:block"><GvuLogo size={54} showText={false} /></span>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-blue-200 uppercase">Glorious Vision University • Administrator</p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">Good day — here's today at GVU</h2>
              <p className="mt-1 text-sm text-blue-100">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} • Morning Shift grace ends 08:30</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onGo("terminal")} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-blue-800 hover:bg-blue-50"><Fingerprint size={16} /> Open Kiosk</button>
            <button onClick={() => onGo("reports")} className="flex items-center gap-2 rounded-xl bg-blue-900/60 px-4 py-2.5 text-sm font-extrabold text-white ring-1 ring-white/25 hover:bg-blue-900"><TrendingUp size={16} /> Reports</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg">
              <Icon size={90} className="absolute -right-4 -bottom-4 opacity-15" />
              <p className="text-xs font-bold tracking-widest uppercase opacity-80">{c.label}</p>
              <p className="mt-2 text-4xl font-black">{c.value}</p>
              <p className="mt-1 text-xs opacity-80">{c.note}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm xl:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white">Weekly attendance trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last 7 days • Present / Late / Absent</p>
            </div>
            <button onClick={() => onGo("records")} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">View records</button>
          </div>
          <div className="mt-4 h-[280px]"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } } }} /></div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-extrabold text-slate-900 dark:text-white">Recent activity</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Latest system & kiosk events</p>
          {audit_logs.length === 0 ? (
            <div className="mt-4"><EmptyState title="No activity yet" body="Actions will appear here once staff clock in." /></div>
          ) : (
            <ul className="mt-4 space-y-3">
              {audit_logs.slice(0, 6).map((log) => (
                <li key={log.log_id} className="flex gap-3 rounded-xl bg-blue-50/60 p-3 dark:bg-slate-800/60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-[10px] font-black text-white">
                    {log.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{log.details}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{log.timestamp} • {log.action}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-extrabold">Today's snapshot</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-blue-100 text-[11px] tracking-wider text-slate-500 uppercase dark:border-slate-700">
                <th className="py-2">Staff</th><th>Dept</th><th>Check-in</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {todayRows.slice(0, 5).map((r) => {
                const s = staffById(r.staff_id);
                return (
                  <tr key={r.attendance_id} className="border-b border-blue-50 last:border-0 dark:border-slate-800">
                    <td className="py-2.5 font-bold">{s?.full_name}</td>
                    <td className="text-slate-500">{s ? deptCode(s.department_id) : "—"}</td>
                    <td className="font-mono">{r.check_in ?? "—"}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
