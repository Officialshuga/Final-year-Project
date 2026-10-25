// ============================================================================
// COMPONENT: GvuLogo — Glorious Vision University official crest + wordmark
// Used on EVERY page (sidebar, topbar, login, kiosk, footers) per requirement.
// The crest is the real GVU seal image at /images/gvu-logo.png.
// It sits inside a white circle so it looks clean on blue/dark backgrounds.
// ============================================================================
// Import the seal through Vite so it is bundled/inlined into the single-file
// build (works even when you just double-click dist/index.html).
import gvuSeal from "../../public/images/gvu-logo.png";

interface Props {
  size?: number;          // crest height/width in px
  showText?: boolean;     // show "Glorious Vision University" text?
  compact?: boolean;      // compact = smaller subtitle
  light?: boolean;        // light text (for dark/blue backgrounds)
}

export default function GvuLogo({ size = 44, showText = true, compact = false, light = false }: Props) {
  return (
    <div className="flex items-center gap-3">
      {/* ---- Official GVU seal inside a white circle ---- */}
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-blue-900/30 ring-2 ring-white/70"
        style={{ width: size, height: size }}
      >
        <img
          src={gvuSeal}
          alt="Glorious Vision University crest"
          className="h-full w-full object-contain p-0.5"
        />
      </div>

      {/* ---- Wordmark ---- */}
      {showText && (
        <div className="leading-tight">
          <p className={`font-extrabold tracking-tight ${compact ? "text-[15px]" : "text-lg"} ${light ? "text-white" : "text-slate-900 dark:text-white"}`}>
            Glorious Vision <span className="text-blue-600 dark:text-blue-400">University</span>
          </p>
          <p className={`font-medium tracking-[0.18em] uppercase ${compact ? "text-[9px]" : "text-[10px]"} ${light ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
            Staff Attendance • Biometric
          </p>
        </div>
      )}
    </div>
  );
}
