import { CATEGORIES, type Category, type Expense } from "./types";
import { sumAmounts, totalsByCategory, type CategoryTotal } from "./analytics";
import { toISODate } from "./format";

export type TopCategoriesPeriod = "month" | "3months" | "year" | "all";

export const TOP_CATEGORIES_PERIODS: ReadonlyArray<{ value: TopCategoriesPeriod; label: string }> = [
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

/** Inclusive local date range, YYYY-MM-DD. `null` means unbounded on that side. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

/** Calendar-based ranges: "Last 3 months" is this month plus the two before it, matching the analytics page. */
export function periodRange(period: TopCategoriesPeriod, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "month":
      return { from: toISODate(new Date(y, m, 1)), to: toISODate(new Date(y, m + 1, 0)) };
    case "3months":
      return { from: toISODate(new Date(y, m - 2, 1)), to: toISODate(new Date(y, m + 1, 0)) };
    case "year":
      return { from: toISODate(new Date(y, 0, 1)), to: toISODate(new Date(y, 11, 31)) };
    case "all":
    default:
      return { from: null, to: null };
  }
}

/** Positive, finite amount in a known category. Anything else is skipped rather than poisoning the totals. */
export function isCountable(e: Expense): boolean {
  return (
    typeof e.amount === "number" &&
    Number.isFinite(e.amount) &&
    e.amount > 0 &&
    (CATEGORIES as readonly string[]).includes(e.category)
  );
}

export function inRange(e: Expense, range: DateRange): boolean {
  if (range.from && e.date < range.from) return false;
  if (range.to && e.date > range.to) return false;
  return true;
}

export interface RankedCategory extends CategoryTotal {
  /** 1-based position after sorting. */
  rank: number;
}

const ORDER = new Map<Category, number>(CATEGORIES.map((c, i) => [c, i]));

/**
 * Categories with spend, highest total first. Ties break on more expenses, then on the
 * canonical CATEGORIES order, so the ranking is stable across renders.
 */
export function rankCategories(expenses: Expense[]): RankedCategory[] {
  return totalsByCategory(expenses.filter(isCountable))
    .sort((a, b) => b.total - a.total || b.count - a.count || (ORDER.get(a.category) ?? 0) - (ORDER.get(b.category) ?? 0))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export interface TopCategoriesResult {
  range: DateRange;
  rows: RankedCategory[];
  /** Sum of all counted expenses in the period. */
  total: number;
  /** Number of counted expenses in the period. */
  count: number;
  /** Categories with no spend in the period, in canonical order. */
  unused: Category[];
}

export function topCategories(expenses: Expense[], period: TopCategoriesPeriod, now = new Date()): TopCategoriesResult {
  const range = periodRange(period, now);
  const counted = expenses.filter((e) => isCountable(e) && inRange(e, range));
  const rows = rankCategories(counted);
  const used = new Set(rows.map((r) => r.category));
  return {
    range,
    rows,
    total: sumAmounts(counted),
    count: counted.length,
    unused: CATEGORIES.filter((c) => !used.has(c)),
  };
}
