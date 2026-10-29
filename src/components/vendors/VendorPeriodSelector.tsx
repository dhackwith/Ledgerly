"use client";

import { VENDOR_PERIODS, type VendorPeriod } from "@/lib/topVendors";

interface Props {
  value: VendorPeriod;
  onChange: (period: VendorPeriod) => void;
}

/** Same segmented control as the analytics `PeriodSelector`, over calendar periods instead of month counts. */
export function VendorPeriodSelector({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Period" className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
      {VENDOR_PERIODS.map((period) => {
        const active = period.value === value;
        return (
          <button
            key={period.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 ${
              active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
