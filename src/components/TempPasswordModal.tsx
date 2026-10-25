// ============================================================================
// COMPONENT: TempPasswordModal
// Shows a freshly generated temporary password ONCE, with a copy button.
// The admin must hand this to the staff member securely (in person).
// ============================================================================
import { useState } from "react";
import { KeyRound, Copy, Check, X, ShieldAlert } from "lucide-react";

export default function TempPasswordModal({ open, who, password, onClose }: {
  open: boolean;
  who: string;              // staff name / username being reset
  password: string;         // the one-time temp password
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  function copy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white"><KeyRound size={18} /></span>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Temporary password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">For {who}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>

        {/* The password + copy */}
        <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
          <code className="flex-1 font-mono text-lg font-black tracking-wider text-blue-800 select-all dark:text-blue-200">{password}</code>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-800">
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>

        {/* Warning */}
        <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            This password is shown <b>only once</b> and is never stored in plain text.
            Hand it to the staff member <b>in person</b> or through a trusted channel.
            It <b>expires in 24 hours</b>, and they must change it on first login.
          </span>
        </div>

        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-blue-700 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800">
          I've copied it — close
        </button>
      </div>
    </div>
  );
}
