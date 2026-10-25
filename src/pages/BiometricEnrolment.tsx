// ============================================================================
// PAGE 4: Biometric Enrolment — pick staff + finger + simulated scan
// TODO(API):
//   GET  /api/staff?enrolled=false        -> staff awaiting enrolment
//   POST /api/biometrics/enroll { staff_id, finger, template_data }
//   (Real scanner SDK e.g. DigitalPersona / SecuGen plugs into doScan())
// ============================================================================
import { useState } from "react";
import { Fingerprint, CheckCircle2, XCircle, RotateCcw, UserRound } from "lucide-react";
import { staff as seedStaff, biometric_templates, deptName, type AppUser } from "../data/mockDatabase";
import { EmptyState } from "../components/Common";

const FINGERS = ["Right Thumb", "Right Index", "Right Middle", "Left Thumb", "Left Index", "Left Middle"];

type ScanState = "idle" | "scanning" | "success" | "failed";

export default function BiometricEnrolment({ notify, currentUser }: { notify: (t: "success" | "error" | "info", title: string, body?: string) => void; currentUser: AppUser }) {
  // Staff can only enrol THEMSELVES. Admin can pick any staff member.
  const isStaff = currentUser.role === "Staff";
  // Guard: seedStaff may be empty (no staff added yet) — fall back to "".
  const [staffId, setStaffId] = useState(
    isStaff
      ? currentUser.staff_id ?? ""
      : seedStaff.find((s) => !s.enrolled)?.staff_id ?? seedStaff[0]?.staff_id ?? ""
  );
  const [finger, setFinger] = useState(FINGERS[1]);
  const [scan, setScan] = useState<ScanState>("idle");
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState<number | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(biometric_templates.length);

  const selected = seedStaff.find((s) => s.staff_id === staffId);
  const alreadyEnrolled = biometric_templates.some((t) => t.staff_id === staffId && t.finger === finger);

  // ---- Simulated scanner: animates progress, then randomly succeeds ----
  function doScan() {
    if (scan === "scanning") return;
    setScan("scanning");
    setProgress(0);
    setQuality(null);

    // Beginner-friendly: interval updates progress bar until 100%
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.floor(Math.random() * 14) + 6;
        if (next >= 100) {
          clearInterval(timer);
          // 85% success rate for demo realism
          const ok = Math.random() > 0.15;
          if (ok) {
            const q = 82 + Math.floor(Math.random() * 17);
            setQuality(q);
            setScan("success");
            setEnrolledCount((c) => c + 1);
            // TODO(API): POST /api/biometrics/enroll — save template BLOB
            notify("success", "Fingerprint enrolled", `${selected?.full_name} • ${finger} • Quality ${q}%`);
          } else {
            setScan("failed");
            notify("error", "Scan failed", "Poor image quality — clean the sensor and retry.");
          }
          return 100;
        }
        return next;
      });
    }, 220);
  }

  function reset() { setScan("idle"); setProgress(0); setQuality(null); }

  // Empty state: no staff have been added yet.
  if (seedStaff.length === 0) {
    return (
      <div className="animate-fade-up">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title="No staff to enrol yet"
            body="Add staff members first in Staff Management, then come back here to register their fingerprints."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Left: form */}
      <div className="space-y-5 xl:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 font-extrabold"><UserRound size={17} className="text-blue-700" /> 1 • {isStaff ? "Your account" : "Select staff member"}</h3>
          <select value={staffId} disabled={isStaff} onChange={(e) => { setStaffId(e.target.value); reset(); }} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            {(isStaff ? seedStaff.filter((s) => s.staff_id === currentUser.staff_id) : seedStaff).map((s) => (
              <option key={s.staff_id} value={s.staff_id}>{s.full_name} — {s.staff_id} {s.enrolled ? "(enrolled)" : "(not enrolled)"}</option>
            ))}
          </select>
          {isStaff && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">You can only enrol your own fingerprint.</p>}
          {selected && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${selected.avatar_color} text-sm font-black text-white`}>
                {selected.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <div className="text-sm">
                <p className="font-extrabold">{selected.full_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{deptName(selected.department_id)} • {selected.role_title}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-extrabold">2 • Choose finger</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
            {FINGERS.map((f) => (
              <button key={f} onClick={() => { setFinger(f); reset(); }}
                className={`rounded-xl border px-3 py-2.5 text-xs font-extrabold transition ${finger === f ? "border-blue-700 bg-blue-700 text-white shadow-lg" : "border-slate-300 hover:border-blue-400 dark:border-slate-700"}`}>
                {f}
              </button>
            ))}
          </div>
          {alreadyEnrolled && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Note: this finger already has a template. Re-enrolling will overwrite it.</p>}
        </div>
      </div>

      {/* Right: scanner */}
      <div className="xl:col-span-3">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-gradient-to-r from-blue-800 to-indigo-800 px-6 py-4 text-white">
            <h3 className="font-extrabold">3 • Capture fingerprint</h3>
            <p className="text-xs text-blue-100">Place the selected finger flat on the scanner when ready</p>
          </div>
          <div className="flex flex-col items-center px-6 py-8">
            {/* Scanner visual */}
            <div className={`relative flex h-56 w-56 items-center justify-center rounded-[2rem] border-4 transition ${scan === "scanning" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : scan === "success" ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : scan === "failed" ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`}>
              <Fingerprint size={110} className={`${scan === "scanning" ? "animate-fingerprint-pulse text-blue-600" : scan === "success" ? "text-blue-700" : scan === "failed" ? "text-red-500" : "text-slate-300 dark:text-slate-600"}`} strokeWidth={1.2} />
              {/* moving laser line while scanning */}
              {scan === "scanning" && <div className="animate-scan-line absolute right-4 left-4 h-1 rounded-full bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_18px_#3b82f6]" />}
              {scan === "success" && <span className="absolute -right-2 -bottom-2 rounded-full bg-blue-600 p-2 text-white shadow-lg"><CheckCircle2 size={22} /></span>}
              {scan === "failed" && <span className="absolute -right-2 -bottom-2 rounded-full bg-red-500 p-2 text-white shadow-lg"><XCircle size={22} /></span>}
            </div>

            {/* Progress */}
            <div className="mt-6 w-full max-w-sm">
              <div className="flex justify-between text-xs font-bold text-slate-500"><span>{scan === "idle" ? "Ready" : scan === "scanning" ? `Scanning… ${progress}%` : scan === "success" ? "Capture complete" : "Capture failed"}</span><span>{enrolledCount} templates stored</span></div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-full rounded-full transition-all ${scan === "failed" ? "bg-red-500" : scan === "success" ? "bg-blue-600" : "bg-blue-600"}`} style={{ width: `${scan === "idle" ? 0 : progress}%` }} />
              </div>
            </div>

            {/* Result banner */}
            {scan === "success" && quality !== null && (
              <div className="mt-5 w-full max-w-sm rounded-2xl bg-blue-50 p-4 text-center ring-1 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-900">
                <p className="font-extrabold text-blue-800 dark:text-blue-200">Enrolment successful!</p>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">{selected?.full_name} • {finger} • Quality score {quality}%</p>
              </div>
            )}
            {scan === "failed" && (
              <div className="mt-5 w-full max-w-sm rounded-2xl bg-red-50 p-4 text-center ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
                <p className="font-extrabold text-red-700 dark:text-red-200">Scan failed — try again</p>
                <p className="mt-1 text-sm text-red-600 dark:text-red-300">Ensure the finger is clean, dry and centred.</p>
              </div>
            )}

            <div className="mt-6 flex w-full max-w-sm gap-3">
              <button onClick={reset} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold dark:border-slate-700"><RotateCcw size={15} /> Reset</button>
              <button onClick={doScan} disabled={scan === "scanning"} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-blue-800 disabled:opacity-60">
                <Fingerprint size={16} /> {scan === "scanning" ? "Scanning…" : "Scan fingerprint"}
              </button>
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">Demo mode: no hardware needed — success/fail is simulated. Real SDK call goes inside doScan().</p>
          </div>
        </div>
      </div>
    </div>
  );
}
