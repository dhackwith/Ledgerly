import { CATEGORY_META } from "@/lib/categories";
import type { BudgetProgress, BudgetState } from "@/lib/budgets";
import { formatCurrency, formatPercent } from "@/lib/format";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/ui/Icons";

const STATE_TEXT: Record<BudgetState, string> = { over: "text-red-700", near: "text-amber-700", ok: "text-emerald-700" };

/** Short state label: words + icon, never colour alone. */
export function BudgetStateLabel({ progress, className = "" }: { progress: BudgetProgress; className?: string }) {
  const { state, remaining, ratio } = progress;
  const icon =
    state === "ok" ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <AlertTriangleIcon className="h-3.5 w-3.5" />;
  const text =
    state === "over"
      ? `Over by ${formatCurrency(Math.abs(remaining))}`
      : state === "near"
        ? `${formatPercent(ratio)} used`
        : "On track";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${STATE_TEXT[state]} ${className}`}>
      {icon}
      {text}
    </span>
  );
}

interface BudgetBarProps {
  progress: BudgetProgress;
  /** Bar height. */
  size?: "sm" | "md";
}

/** Accessible progress bar filled with the category colour; the state is conveyed by text elsewhere. */
export function BudgetBar({ progress, size = "md" }: BudgetBarProps) {
  const { category, spent, limit, ratio, state } = progress;
  const color = CATEGORY_META[category].color;
  const width = `${Math.min(ratio, 1) * 100}%`;
  const height = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div
      role="progressbar"
      aria-label={`${category} budget`}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(spent, limit)}
      aria-valuetext={`${formatCurrency(spent)} of ${formatCurrency(limit)}, ${formatPercent(ratio)} used${state === "over" ? ", over budget" : ""}`}
      className={`relative w-full overflow-hidden rounded-full bg-slate-100 ${height}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width,
          backgroundColor: color,
          // Diagonal stripes when over, so the full bar reads differently from "exactly on budget".
          backgroundImage:
            state === "over"
              ? "repeating-linear-gradient(135deg, rgba(255,255,255,0.35) 0 4px, transparent 4px 8px)"
              : undefined,
        }}
      />
      {state !== "ok" && (
        // 80% marker so the "near" threshold is visible on the bar itself.
        <div className="absolute inset-y-0 w-px bg-slate-400/70" style={{ left: "80%" }} aria-hidden />
      )}
    </div>
  );
}
