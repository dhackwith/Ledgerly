import { toISODate } from "@/lib/format";

export interface RangePreset {
  id: string;
  label: string;
  range: (now: Date) => { from: string; to: string };
}

const day = (y: number, m: number, d: number) => toISODate(new Date(y, m, d));

export const RANGE_PRESETS: RangePreset[] = [
  { id: "all", label: "All time", range: () => ({ from: "", to: "" }) },
  {
    id: "this-month",
    label: "This month",
    range: (n) => ({ from: day(n.getFullYear(), n.getMonth(), 1), to: toISODate(n) }),
  },
  {
    id: "last-month",
    label: "Last month",
    range: (n) => ({ from: day(n.getFullYear(), n.getMonth() - 1, 1), to: day(n.getFullYear(), n.getMonth(), 0) }),
  },
  {
    id: "last-90",
    label: "Last 90 days",
    range: (n) => ({ from: day(n.getFullYear(), n.getMonth(), n.getDate() - 89), to: toISODate(n) }),
  },
  {
    id: "this-year",
    label: "Year to date",
    range: (n) => ({ from: day(n.getFullYear(), 0, 1), to: toISODate(n) }),
  },
  {
    id: "last-year",
    label: "Last year",
    range: (n) => ({ from: day(n.getFullYear() - 1, 0, 1), to: day(n.getFullYear() - 1, 11, 31) }),
  },
];

/** The preset whose range matches exactly, if any. */
export function matchPreset(from: string, to: string, now = new Date()): RangePreset | undefined {
  return RANGE_PRESETS.find((p) => {
    const r = p.range(now);
    return r.from === from && r.to === to;
  });
}
