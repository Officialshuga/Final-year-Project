// ============================================================================
// PAGE 5: Attendance Terminal (KIOSK) — big touch-friendly clock-in screen
// - Live clock, huge fingerprint pad, simulated identification
// - Shows name / dept / time / Present-or-Late after each scan
// TODO(API): POST /api/attendance/clock-in { template_match } -> staff record
//   Real flow: scanner SDK returns template -> backend 1:N match -> staff_id
// ============================================================================
import { useEffect, useState } from "react";
import { Fingerprint, CheckCircle2, Clock3, LogIn } from "lucide-react";
import GvuLogo from "../components/GvuLogo";
import { staff, deptName, shiftName, type StaffMember } from "../data/mockDatabase";

type KioskState = "ready" | "scanning" | "done";

export default function AttendanceTerminal({ notify }: { notify: (t: "success" | "error" | "info", title: string, body?: string) => void }) {
  const [now, setNow] = useState(new Date());
  const [state, setState] = useState<KioskState>("ready");
  const [matched, setMatched] = useState<StaffMember | null>(null);
  const [matchTime, setMatchTime] = useState("");
  const [history, setHistory] = useState<Array<{ name: string; id: string; time: string; status: string }>>([]);

  // ---- Server-synced live clock ----
  // The kiosk clock must follow the SERVER, not the device. We fetch the server
  // time, compute the offset between server and this device, and tick locally
  // using that offset. We re-sync on load and every 5 minutes.
  const [offsetMs, setOffsetMs] = useState(0); // serverTime - deviceTime

  useEffect(() => {
    const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
    async function syncServerTime() {
      try {
        // TODO(API): GET /api/system/time — authoritative server clock.
        const res = await fetch(`${API}/system/time`);
        if (!res.ok) return;
        const data = await res.json();
        setOffsetMs(data.epoch_ms - Date.now()); // drift between server & device
      } catch {
        // Offline/dev without backend: fall back to device time (offset 0).
      }
    }
    syncServerTime();
    const resync = setInterval(syncServerTime, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(resync);
  }, []);

  // Tick every second, always showing SERVER time (device time + offset).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date(Date.now() + offsetMs)), 1000);
    return () => clearInterval(t);
  }, [offsetMs]);

  const hhmm = now.toTimeString().slice(0, 5);
  const isLate = hhmm > "08:30"; // matches Morning Shift grace period

  function simulateScan() {
    if (state === "scanning") return;
    setState("scanning");
    setMatched(null);
    // Simulate 2.2s hardware match delay
    setTimeout(() => {
      // Pick a random ENROLLED + ACTIVE staff member as the "identified" person
      const pool = staff.filter((s) => s.enrolled && s.status === "Active");
      // Guard: no enrolled staff yet — show a "not recognised" message.
      if (pool.length === 0) {
        setState("ready");
        notify("error", "No match found", "No enrolled staff in the system yet. Enrol a fingerprint first.");
        return;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const time = new Date().toTimeString().slice(0, 5);
      const status = time > "08:30" ? "Late" : "Present";
      setMatched(pick);
      setMatchTime(time);
      setState("done");
      setHistory((h) => [{ name: pick.full_name, id: pick.staff_id, time, status }, ...h].slice(0, 6));
      // TODO(API): await fetch('/api/attendance/clock-in', { method:'POST', ... })
      notify(status === "Late" ? "info" : "success", `${pick.full_name} — ${status}`, `Checked in at ${time}`);
    }, 2200);
  }

  function reset() { setState("ready"); setMatched(null); }

  return (
    <div className="animate-fade-up mx-auto max-w-5xl space-y-5">
      {/* Kiosk header with GVU branding + live clock */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white shadow-2xl">
        <div className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row sm:p-8">
          <GvuLogo light size={56} />
          <div className="text-center sm:text-right">
            <p className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.25em] text-blue-200 uppercase sm:justify-end"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live • Kiosk 01 • Main Gate</p>
            <p className="mt-1 font-mono text-5xl font-black tracking-tight tabular-nums">{now.toLocaleTimeString("en-GB")}</p>
            <p className="mt-1 text-sm text-blue-100">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Scanner pad */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black">Place your finger on the scanner</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {state === "ready" && "Touch the pad below to clock in"}
            {state === "scanning" && "Identifying… keep your finger still"}
            {state === "done" && "Identification complete"}
          </p>

          <button
            onClick={simulateScan} disabled={state === "scanning"}
            className={`relative mx-auto mt-6 flex h-64 w-64 items-center justify-center rounded-full transition ${state === "scanning" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40"} ring-8 ${state === "done" && matched ? "ring-sky-200 dark:ring-sky-900" : "ring-blue-100 dark:ring-blue-950"}`}
            aria-label="Scan fingerprint"
          >
            {state === "scanning" && (
              <>
                <span className="animate-kiosk-ring absolute inset-0 rounded-full border-4 border-blue-500" />
                <span className="animate-kiosk-ring absolute inset-0 rounded-full border-4 border-blue-400" style={{ animationDelay: "0.6s" }} />
              </>
            )}
            <span className={`flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br shadow-inner ${state === "scanning" ? "from-blue-600 to-indigo-700" : state === "done" ? "from-sky-500 to-blue-700" : "from-blue-700 to-indigo-800"}`}>
              <Fingerprint size={96} strokeWidth={1.1} className={`text-white ${state === "scanning" ? "animate-fingerprint-pulse" : ""}`} />
            </span>
          </button>

          <div className="mx-auto mt-6 flex max-w-xs gap-3">
            <button onClick={simulateScan} disabled={state === "scanning"} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-700 py-3.5 text-sm font-extrabold text-white shadow-xl hover:bg-blue-800 disabled:opacity-60">
              <LogIn size={16} /> {state === "scanning" ? "Scanning…" : "Tap to scan"}
            </button>
            {state === "done" && <button onClick={reset} className="rounded-2xl border border-slate-300 px-5 py-3.5 text-sm font-bold dark:border-slate-700">Next</button>}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Grace period ends 08:30 — arrivals after are marked <b>Late</b>. Current time {hhmm} → would be <b>{isLate ? "Late" : "Present"}</b>.</p>
        </div>

        {/* Result + recent */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-xs font-extrabold tracking-widest text-slate-500 uppercase dark:text-slate-400">Last identification</h4>
            {state !== "done" || !matched ? (
              <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
                <Clock3 size={28} className="text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-500">{state === "scanning" ? "Matching fingerprint…" : "Waiting for scan"}</p>
                <p className="text-xs text-slate-400">Result will appear here</p>
              </div>
            ) : (
              <div className="animate-fade-up mt-4 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/70">
                <div className="flex items-center gap-4">
                  <span className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${matched.avatar_color} text-lg font-black text-white`}>
                    {matched.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black">{matched.full_name}</p>
                    <p className="text-xs text-slate-500">{matched.staff_id} • {deptName(matched.department_id)}</p>
                    <p className="text-xs text-slate-500">{shiftName(matched.shift_id)} • {matchTime}</p>
                  </div>
                  <CheckCircle2 size={30} className="shrink-0 text-blue-600" />
                </div>
                <div className={`mt-4 rounded-xl py-3 text-center text-lg font-black tracking-wide ${matchTime > "08:30" ? "bg-sky-100 text-sky-800" : "bg-blue-100 text-blue-700"}`}>
                  {matchTime > "08:30" ? "LATE" : "PRESENT"} • {matchTime}
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">Welcome{new Date().getHours() < 12 ? " — good morning" : new Date().getHours() < 17 ? " — good afternoon" : " — good evening"}, {matched.full_name.split(" ")[0]}! Have a productive day at GVU.</p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-xs font-extrabold tracking-widest text-slate-500 uppercase dark:text-slate-400">Recent clock-ins (this kiosk)</h4>
            <ul className="mt-3 space-y-2">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm dark:bg-slate-800/70">
                  <span><b>{h.name}</b> <span className="text-xs text-slate-500">• {h.time}</span></span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${h.status === "Late" ? "bg-sky-100 text-sky-800" : "bg-blue-100 text-blue-700"}`}>{h.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
