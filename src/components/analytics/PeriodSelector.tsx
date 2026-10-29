"use client";

export type Period = 3 | 6 | 12;

export const PERIODS: readonly Period[] = [3, 6, 12];

interface Props {
  value: Period;
  onChange: (period: Period) => void;
}

/** Segmented control for the analytics window. `aria-pressed` carries the state, not just the styling. */
export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Period" className="inline-flex rounded-lg bg-slate-100 p-1">
      {PERIODS.map((period) => {
        const active = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 ${
              active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {period} months
          </button>
        );
      })}
    </div>
  );
}
