import { CATEGORIES, type Category, type Expense } from "./types";
import { toISODate } from "./format";

/** Whole cents for one expense, so sums never drift (same approach as `sumAmounts`). */
function cents(amount: number): number {
  return Math.round(amount * 100);
}

/** Plain code-unit comparison: deterministic regardless of the runtime locale. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export type VendorPeriod = "month" | "quarter" | "year" | "all";

export const VENDOR_PERIODS: ReadonlyArray<{ value: VendorPeriod; label: string }> = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "Last 3 months" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

/** Inclusive YYYY-MM-DD bounds; `null` means unbounded on that side. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

/**
 * Calendar bounds for a period. "Last 3 months" matches the analytics page: the current month
 * plus the two before it. Periods run to the end of the current month/year, so future-dated
 * expenses inside it are included.
 */
export function periodRange(period: VendorPeriod, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const endOfMonth = toISODate(new Date(y, m + 1, 0));
  switch (period) {
    case "month":
      return { from: toISODate(new Date(y, m, 1)), to: endOfMonth };
    case "quarter":
      return { from: toISODate(new Date(y, m - 2, 1)), to: endOfMonth };
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "all":
    default:
      return { from: null, to: null };
  }
}

export function inRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Vendor names
// ---------------------------------------------------------------------------

/**
 * A trailing store or reference number: "#12" / "#1234" (any length after a hash), or a
 * standalone number of 3+ digits ("Shell 04512"). Shorter bare numbers are kept so names like
 * "Route 66" or "Studio 54" survive.
 */
const TRAILING_REFERENCE = /(?:\s*#\s*\d+|\s+\d{3,})$/;
/** Trailing separators, including ones left dangling by a removed reference ("Starbucks - #12"). */
const TRAILING_SEPARATORS = /[\s\-–—*:,.]+$/;

/**
 * Vendor name derived from a free-text description, case preserved: whitespace trimmed and
 * collapsed, then one trailing reference number and any trailing separators (" - ", ".", ",")
 * removed. Returns
 * "" for empty or whitespace-only descriptions. If stripping would leave nothing (e.g. "#1234"),
 * the whitespace-normalised description is kept as is.
 */
export function vendorName(description: string): string {
  const collapsed = description.trim().replace(/\s+/g, " ");
  const stripped = collapsed.replace(TRAILING_REFERENCE, "").replace(TRAILING_SEPARATORS, "");
  return stripped || collapsed;
}

/** Grouping key: the vendor name, lower-cased. "" means the description was empty. */
export function vendorKey(description: string): string {
  return vendorName(description).toLowerCase();
}

export const UNSPECIFIED_VENDOR = "Unspecified";

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface VendorTotal {
  /** Grouping key from `vendorKey`; "" for the Unspecified bucket. */
  key: string;
  /** Most frequent spelling in the group, or "Unspecified". */
  name: string;
  unspecified: boolean;
  total: number;
  count: number;
  /** Fraction of the period total, 0..1. */
  share: number;
  /** Category used most often for this vendor (ties: higher spend, then category order). */
  topCategory: Category;
}

export interface VendorSummary {
  /** Sum of every counted expense in the period. */
  total: number;
  count: number;
  /** Every vendor in the period, highest total first. */
  vendors: VendorTotal[];
}

interface Spelling {
  count: number;
  latest: string;
}

interface Group {
  cents: number;
  count: number;
  spellings: Map<string, Spelling>;
  categories: Map<Category, { count: number; cents: number }>;
}

/** Most frequent spelling; ties go to the most recently used one, then code-unit order. */
function pickName(spellings: Map<string, Spelling>): string {
  let best: [string, Spelling] | null = null;
  for (const entry of Array.from(spellings.entries())) {
    if (!best) {
      best = entry;
      continue;
    }
    const [name, s] = entry;
    const [bestName, b] = best;
    const better =
      s.count !== b.count ? s.count > b.count : s.latest !== b.latest ? s.latest > b.latest : compareStrings(name, bestName) < 0;
    if (better) best = entry;
  }
  return best ? best[0] : "";
}

function pickCategory(categories: Group["categories"]): Category {
  let best: Category = CATEGORIES[0];
  let bestStats = { count: -1, cents: -1 };
  // Iterating in CATEGORIES order and only replacing on a strict win makes that order the final tie-break.
  for (const c of CATEGORIES) {
    const stats = categories.get(c);
    if (!stats) continue;
    if (stats.count > bestStats.count || (stats.count === bestStats.count && stats.cents > bestStats.cents)) {
      best = c;
      bestStats = stats;
    }
  }
  return best;
}

/**
 * Totals per vendor for the expenses inside `range` (inclusive). Expenses whose amount is not a
 * finite positive number are ignored entirely. Empty descriptions are grouped as "Unspecified"
 * and ranked like any other vendor, so shares always add up to the period total.
 * Sorted by total, then count, then key, all descending except the key.
 */
export function vendorTotals(expenses: Expense[], range: DateRange = { from: null, to: null }): VendorSummary {
  const groups = new Map<string, Group>();
  let totalCents = 0;
  let count = 0;
  for (const e of expenses) {
    if (typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) continue;
    if (!inRange(e.date, range)) continue;
    const amount = cents(e.amount);
    const name = vendorName(e.description ?? "");
    const key = name.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { cents: 0, count: 0, spellings: new Map(), categories: new Map() };
      groups.set(key, g);
    }
    g.cents += amount;
    g.count += 1;
    const spelling = g.spellings.get(name);
    if (spelling) {
      spelling.count += 1;
      if (e.date > spelling.latest) spelling.latest = e.date;
    } else {
      g.spellings.set(name, { count: 1, latest: e.date });
    }
    const cat = g.categories.get(e.category) ?? { count: 0, cents: 0 };
    cat.count += 1;
    cat.cents += amount;
    g.categories.set(e.category, cat);
    totalCents += amount;
    count += 1;
  }

  const vendors = Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      name: key ? pickName(g.spellings) : UNSPECIFIED_VENDOR,
      unspecified: key === "",
      cents: g.cents,
      count: g.count,
      topCategory: pickCategory(g.categories),
    }))
    .sort((a, b) => b.cents - a.cents || b.count - a.count || compareStrings(a.key, b.key))
    .map(({ cents: c, ...rest }) => ({ ...rest, total: c / 100, share: totalCents > 0 ? c / totalCents : 0 }));

  return { total: totalCents / 100, count, vendors };
}

/** The first `limit` vendors (already ranked). A negative or fractional limit is clamped/floored. */
export function topVendors(vendors: VendorTotal[], limit: number): VendorTotal[] {
  return vendors.slice(0, Math.max(0, Math.floor(limit)));
}
