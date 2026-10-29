"use client";

import { TOP_CATEGORIES_PERIODS, type TopCategoriesPeriod } from "@/lib/topCategories";

/** Shorter labels so all four options fit on one row on a phone. */
const SHORT_LABELS: Record<TopCategoriesPeriod, string> = {
  month: "Month",
  "3months": "3 months",
  year: "Year",
  all: "All time",
};

interface Props {
  value: TopCategoriesPeriod;
  onChange: (period: TopCategoriesPeriod) => void;
}

/** Same segmented control as the analytics PeriodSelector, with named periods instead of month counts. */
export function CategoryPeriodSelector({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Period" className="grid grid-cols-4 rounded-lg bg-slate-100 p-1 sm:inline-flex">
      {TOP_CATEGORIES_PERIODS.map(({ value: period, label }) => {
        const active = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period)}
            className={`whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 sm:px-3 ${
              active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className="sm:hidden">{SHORT_LABELS[period]}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
