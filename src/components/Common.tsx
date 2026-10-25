// ============================================================================
// FILE: Common.tsx — small reusable UI pieces shared by all pages.
// Contains: Toast stack, ConfirmDialog, EmptyState, StatCard, Badges, Modal.
// Beginner tip: keep shared UI here so pages stay short and readable.
// ============================================================================
import { AlertTriangle, CheckCircle2, Info, X, XCircle, Loader2, Inbox } from "lucide-react";

// ---------------- Toasts ----------------
export interface ToastMsg { id: number; type: "success" | "error" | "info"; title: string; body?: string; }

export function ToastStack({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <span className={`mt-0.5 rounded-full p-1.5 ${t.type === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : t.type === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"}`}>
            {t.type === "success" ? <CheckCircle2 size={16} /> : t.type === "error" ? <XCircle size={16} /> : <Info size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.body}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Confirm dialog (for destructive actions) ----------------
export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onCancel, onConfirm }: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
          <AlertTriangle size={22} />
        </div>
        <h3 className="mt-4 text-center text-lg font-extrabold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={onConfirm} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Generic modal shell ----------------
export function Modal({ open, title, subtitle, onClose, children, wide }: {
  open: boolean; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`animate-fade-up w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl dark:bg-slate-900`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------- Empty / Loading / Error states ----------------
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"><Inbox size={22} /></span>
      <p className="mt-4 font-extrabold text-slate-800 dark:text-slate-100">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300"><Loader2 className="animate-spin" size={16} /> Loading records…</div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

// ---------------- Status / Role badges ----------------
export function StatusBadge({ status }: { status: string }) {
  // Blue-first theme. Present uses blue; Late/Absent keep a light warning tint
  // so attendance reports stay readable, but overall palette is blue-led.
  const map: Record<string, string> = {
    Present: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Late: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    Absent: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    Active: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Inactive: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide ${map[status] ?? "bg-blue-100 text-blue-700"}`}>{status.toUpperCase()}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    Admin: "bg-blue-700 text-white",
    Staff: "bg-blue-400 text-white",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${map[role] ?? "bg-slate-500 text-white"}`}>{role}</span>;
}

// ---------------- Form helpers (label + input styles) ----------------
export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
export const labelCls = "mb-1.5 block text-xs font-extrabold tracking-wide text-slate-600 uppercase dark:text-slate-300";
