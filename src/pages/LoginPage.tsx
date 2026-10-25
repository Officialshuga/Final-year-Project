// ============================================================================
// PAGE 1: Login — username + password + role selection + basic validation
// TODO(API): Replace handleLogin() with POST /api/auth/login
//   const res = await fetch('/api/auth/login', { method:'POST', body: JSON.stringify({username,password,role}) })
//   Save returned JWT: localStorage.setItem('gvu_token', res.token)
// ============================================================================
import { useState } from "react";
import { User, Lock, Eye, EyeOff, Fingerprint, Moon, Sun, AlertCircle, X, KeyRound } from "lucide-react";
import GvuLogo from "../components/GvuLogo";
import { users, staffById, deptName, type UserRole } from "../data/mockDatabase";
import { addResetRequest } from "../data/resetRequests";

interface Props {
  onLogin: (username: string, role: UserRole) => void;
  notify: (type: "success" | "error" | "info", title: string, body?: string) => void;
  dark: boolean;
  onToggleTheme: () => void;
}

export default function LoginPage({ onLogin, notify, dark, onToggleTheme }: Props) {
  // ---- form state (beginner: one useState per field is easiest to read) ----
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // ---- Forgot-password modal state ----
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStaffId, setForgotStaffId] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // The SAME generic message is always shown (prevents staff-ID enumeration).
  const GENERIC_MSG = "If this account exists, your request has been sent to the administrator.";

  // Submit a password-reset request.
  function submitForgot(ev: React.FormEvent) {
    ev.preventDefault();
    const staffId = forgotStaffId.trim();
    if (staffId.length < 2) {
      notify("error", "Enter your staff ID", "Please type your staff ID.");
      return;
    }
    // Resolve the person ONLY for the admin's display (never revealed to user).
    // A staff login is linked by staff_id; match on that or on username.
    const match = users.find(
      (u) => u.staff_id?.toLowerCase() === staffId.toLowerCase() ||
             u.username.toLowerCase() === staffId.toLowerCase()
    );
    const staff = match?.staff_id ? staffById(match.staff_id) : undefined;

    // TODO(API): POST /api/password-requests { staff_id, message }
    // Backend rate-limits + ignores duplicates + never reveals validity.
    addResetRequest(staffId, forgotMessage, {
      full_name: match?.full_name ?? "Unknown",
      department: staff ? deptName(staff.department_id) : "—",
    });

    // ALWAYS show the generic success screen, regardless of validity/duplicate.
    setForgotSent(true);
  }

  function closeForgot() {
    setForgotOpen(false);
    setForgotStaffId("");
    setForgotMessage("");
    setForgotSent(false);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!username.trim()) e.username = "Username is required";
    else if (username.trim().length < 3) e.username = "Username must be at least 3 characters";
    if (!password) e.password = "Password is required";
    else if (password.length < 4) e.password = "Password must be at least 4 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleLogin(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) {
      notify("error", "Check the form", "Please fix the highlighted fields.");
      return;
    }
    setLoading(true);
    // Simulate network delay so loading spinner is visible (remove with real API)
    setTimeout(() => {
      // TODO(API): const res = await fetch('/api/auth/login', {...})
      const found = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      if (!found) {
        setLoading(false);
        setErrors({ username: "No account found for this username (try admin)" });
        notify("error", "Login failed", "Unknown username.");
        return;
      }
      if (found.password !== password) {
        setLoading(false);
        setErrors({ password: "Incorrect password for demo account." });
        notify("error", "Login failed", "Wrong password.");
        return;
      }
      if (!found.active) {
        setLoading(false);
        notify("error", "Account deactivated", "Contact the administrator.");
        return;
      }
      // Note: we sign in using the account's ACTUAL role (found.role), so the
      // selected role toggle never blocks a valid username/password. This keeps
      // login simple and avoids confusing "role mismatch" errors.
      setLoading(false);
      notify("success", `Welcome, ${found.full_name}!`, `Signed in as ${found.role}.`);
      onLogin(found.username, found.role);
    }, 900);
  }

  const input = "w-full rounded-xl border bg-white px-3.5 py-3 pl-11 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 dark:bg-slate-800 ";
  const okCls = "border-slate-300 focus:border-blue-600 focus:ring-blue-600/20 dark:border-slate-700 dark:text-white";
  const errCls = "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:text-white";

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Left: brand panel (hidden on mobile) */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-950 p-10 text-white lg:flex">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <GvuLogo light />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold tracking-widest uppercase ring-1 ring-white/20">
            <Fingerprint size={14} /> Biometric Attendance System
          </span>
          <h1 className="mt-6 text-4xl leading-tight font-black xl:text-5xl">
            <span className="text-amber-300">Welcome!</span>
          </h1>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[["99.2%", "Match accuracy"], ["~3 sec", "Avg. clock-in"], ["100%", "Audit coverage"]].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                <p className="text-xl font-black">{v}</p>
                <p className="mt-1 text-[11px] text-blue-100">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-blue-200">© 2026 Glorious Vision University • ICT Directorate • Final-year project demo</p>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 items-center justify-center p-5 sm:p-10">
        <button onClick={onToggleTheme} className="absolute top-5 right-5 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300" title="Toggle theme">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="animate-fade-up w-full max-w-md">
          <div className="lg:hidden"><GvuLogo size={52} /></div>
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl shadow-blue-900/10 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Staff sign in</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your staff username and password to continue.</p>

            <form onSubmit={handleLogin} noValidate className="mt-6 space-y-4">
              {/* Username */}
              <div>
                <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-600 uppercase dark:text-slate-300">Username</label>
                <div className="relative">
                  <User size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin" className={input + (errors.username ? errCls : okCls)} />
                </div>
                {errors.username && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle size={13} />{errors.username}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-600 uppercase dark:text-slate-300">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                  <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={input + (errors.password ? errCls : okCls) + " pr-11"} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                {errors.password && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle size={13} />{errors.password}</p>}
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-700 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-700/30 transition hover:bg-blue-800 disabled:opacity-60">
                {loading ? "Verifying credentials…" : "Sign in securely"}
              </button>

              {/* Forgot password link */}
              <button type="button" onClick={() => setForgotOpen(true)} className="mx-auto mt-1 flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300">
                <KeyRound size={13} /> Forgot password?
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">Protected by fingerprint identity • Glorious Vision University</p>
        </div>
      </div>

      {/* ---- Forgot password modal ---- */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={closeForgot}>
          <div onClick={(e) => e.stopPropagation()} className="animate-fade-up w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white"><KeyRound size={18} /></span>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Forgot password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Request an admin reset</p>
                </div>
              </div>
              <button onClick={closeForgot} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>

            {forgotSent ? (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <KeyRound size={22} />
                </div>
                <p className="mt-3 font-extrabold text-slate-800 dark:text-white">Request received</p>
                {/* GENERIC message — never reveals whether the staff ID exists */}
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{GENERIC_MSG}</p>
                <button onClick={closeForgot} className="mt-5 w-full rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">Done</button>
              </div>
            ) : (
              <form onSubmit={submitForgot} className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Enter your staff ID and (optionally) a short message. An administrator will review the request and reset your password securely.
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-600 uppercase dark:text-slate-300">Staff ID</label>
                  <div className="relative">
                    <User size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={forgotStaffId} onChange={(e) => setForgotStaffId(e.target.value)} placeholder="e.g. GVU/2026/001" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pl-11 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold tracking-wide text-slate-600 uppercase dark:text-slate-300">Message <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                  <textarea value={forgotMessage} onChange={(e) => setForgotMessage(e.target.value)} rows={3} maxLength={200} placeholder="Add any detail for the administrator…" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeForgot} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button>
                  <button type="submit" className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">Send request</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
