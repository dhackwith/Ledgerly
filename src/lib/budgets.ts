import { CATEGORIES, type Category, type Expense } from "./types";
import { monthKey, toISODate } from "./format";

/** Monthly limits in dollars, keyed by category. An absent key means no budget. */
export type BudgetLimits = Partial<Record<Category, number>>;

export type BudgetState = "ok" | "near" | "over";

export interface BudgetProgress {
  category: Category;
  /** Monthly limit in dollars. */
  limit: number;
  /** Spent this calendar month in dollars. */
  spent: number;
  /** limit - spent; negative when over. */
  remaining: number;
  /** spent / limit. */
  ratio: number;
  state: BudgetState;
}

export interface BudgetSummary {
  budgeted: number;
  spent: number;
  remaining: number;
  ratio: number;
  counts: Record<BudgetState, number>;
}

/** Spending at or above this share of the limit is flagged as "near". */
export const NEAR_THRESHOLD = 0.8;

const STATE_ORDER: Record<BudgetState, number> = { over: 0, near: 1, ok: 2 };

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function monthExpenses(expenses: Expense[], now: Date): Expense[] {
  const key = monthKey(toISODate(now));
  return expenses.filter((e) => monthKey(e.date) === key);
}

/** Whole-cent total spent in a category this calendar month. */
function spentCents(expenses: Expense[], category: Category, now: Date): number {
  return monthExpenses(expenses, now).reduce((acc, e) => (e.category === category ? acc + toCents(e.amount) : acc), 0);
}

export function budgetState(ratio: number): BudgetState {
  if (ratio > 1) return "over";
  if (ratio >= NEAR_THRESHOLD) return "near";
  return "ok";
}

/**
 * Progress for every category that has a limit, for the calendar month containing `now`.
 * Sorted over → near → ok, then by ratio descending, then by category order.
 */
export function budgetProgress(expenses: Expense[], limits: BudgetLimits, now: Date): BudgetProgress[] {
  const rows: BudgetProgress[] = [];
  for (const category of CATEGORIES) {
    const limit = limits[category];
    if (limit === undefined) continue;
    const limitCents = toCents(limit);
    // A zero or invalid limit is treated as "no budget" rather than dividing by zero.
    if (!Number.isFinite(limitCents) || limitCents <= 0) continue;
    const spentC = spentCents(expenses, category, now);
    const ratio = spentC / limitCents;
    rows.push({
      category,
      limit: limitCents / 100,
      spent: spentC / 100,
      remaining: (limitCents - spentC) / 100,
      ratio,
      state: budgetState(ratio),
    });
  }
  const index = new Map(CATEGORIES.map((c, i) => [c, i]));
  rows.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.ratio - a.ratio ||
      (index.get(a.category) ?? 0) - (index.get(b.category) ?? 0),
  );
  return rows;
}

export function budgetSummary(progress: BudgetProgress[]): BudgetSummary {
  const budgetedCents = progress.reduce((acc, p) => acc + toCents(p.limit), 0);
  const spentC = progress.reduce((acc, p) => acc + toCents(p.spent), 0);
  const counts: Record<BudgetState, number> = { ok: 0, near: 0, over: 0 };
  for (const p of progress) counts[p.state]++;
  return {
    budgeted: budgetedCents / 100,
    spent: spentC / 100,
    remaining: (budgetedCents - spentC) / 100,
    ratio: budgetedCents > 0 ? spentC / budgetedCents : 0,
    counts,
  };
}

export function daysInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/**
 * Projects this month's spend for a category by extrapolating the daily average so far
 * (spent ÷ days elapsed, including today) across the whole month.
 */
export function projectedMonthEnd(expenses: Expense[], category: Category, now: Date): number {
  const spentC = spentCents(expenses, category, now);
  const elapsed = Math.max(1, now.getDate());
  return Math.round((spentC / elapsed) * daysInMonth(now)) / 100;
}

export function overLimitCategories(progress: BudgetProgress[]): Category[] {
  return progress.filter((p) => p.state === "over").map((p) => p.category);
}

export function nearLimitCategories(progress: BudgetProgress[]): Category[] {
  return progress.filter((p) => p.state === "near").map((p) => p.category);
}

/** Number of categories with a limit set. */
export function countLimits(limits: BudgetLimits): number {
  return CATEGORIES.filter((c) => limits[c] !== undefined).length;
}

export interface BudgetStreak {
  /** Consecutive days, ending today, on which no budgeted category was over its monthly limit. */
  current: number;
  /** Longest such run within the lookback window. */
  longest: number;
  /** Categories over their monthly limit as of today, in category order. Empty while the streak is alive. */
  overToday: Category[];
}

/** How many days back a streak is counted. */
export const STREAK_LOOKBACK_DAYS = 365;

/**
 * Days without overspending. A day is on budget when, at the end of that day, no category with a
 * limit has spent more than that limit so far in its calendar month, so the streak can carry across
 * months. Today's limits are applied to past days. Days before the first expense are not counted,
 * since nothing was being tracked yet. Returns `null` when no limits are set.
 */
export function budgetStreak(
  expenses: Expense[],
  limits: BudgetLimits,
  now: Date,
  lookbackDays = STREAK_LOOKBACK_DAYS,
): BudgetStreak | null {
  const limitCents = new Map<Category, number>();
  for (const category of CATEGORIES) {
    const limit = limits[category];
    if (limit === undefined) continue;
    const cents = toCents(limit);
    if (Number.isFinite(cents) && cents > 0) limitCents.set(category, cents);
  }
  if (limitCents.size === 0) return null;

  const todayISO = toISODate(now);
  const windowStart = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (Math.max(1, lookbackDays) - 1)));
  let firstExpense = todayISO;
  for (const e of expenses) {
    if (e.date <= todayISO && e.date < firstExpense) firstExpense = e.date;
  }
  const start = firstExpense > windowStart ? firstExpense : windowStart;
  // Month-to-date totals need the days of start's month that fall before start.
  const monthStart = `${monthKey(start)}-01`;

  const byDay = new Map<string, Map<Category, number>>();
  for (const e of expenses) {
    if (e.date < monthStart || e.date > todayISO || !limitCents.has(e.category)) continue;
    const day = byDay.get(e.date) ?? new Map<Category, number>();
    day.set(e.category, (day.get(e.category) ?? 0) + toCents(e.amount));
    byDay.set(e.date, day);
  }

  const monthToDate = new Map<Category, number>();
  let month = "";
  let run = 0;
  let longest = 0;
  let overToday: Category[] = [];
  const [y, m] = monthStart.split("-").map(Number);
  for (let d = new Date(y, m - 1, 1); toISODate(d) <= todayISO; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const iso = toISODate(d);
    if (monthKey(iso) !== month) {
      month = monthKey(iso);
      monthToDate.clear();
    }
    byDay.get(iso)?.forEach((cents, category) => {
      monthToDate.set(category, (monthToDate.get(category) ?? 0) + cents);
    });
    if (iso < start) continue;
    overToday = Array.from(limitCents)
      .filter(([category, limit]) => (monthToDate.get(category) ?? 0) > limit)
      .map(([category]) => category);
    run = overToday.length ? 0 : run + 1;
    longest = Math.max(longest, run);
  }
  return { current: run, longest, overToday };
}
