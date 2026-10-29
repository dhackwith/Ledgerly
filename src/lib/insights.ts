import { CATEGORIES, type Category, type Expense } from "./types";
import { sumAmounts, totalsByCategory, totalsByDay } from "./analytics";
import { formatCurrency, formatDate, formatPercent, monthKey, toISODate } from "./format";

/** Whole cents for one expense, so sums never drift (same approach as `sumAmounts`). */
function cents(amount: number): number {
  return Math.round(amount * 100);
}

function emptyCategoryRecord(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
}

/** Local-date helpers (dates are YYYY-MM-DD strings, compared lexically). */
function shiftMonth(now: Date, offset: number): Date {
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function shiftDay(now: Date, offset: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** 0 = Monday … 6 = Sunday, from a YYYY-MM-DD string. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, (m ?? 1) - 1, d ?? 1).getDay() + 6) % 7;
}

// ---------------------------------------------------------------------------
// Monthly totals per category (stacked chart)
// ---------------------------------------------------------------------------

export interface MonthCategoryTotals {
  month: string;
  total: number;
  byCategory: Record<Category, number>;
}

/** Per-month totals per category for the last `months` calendar months, including empty months. */
export function monthlyByCategory(expenses: Expense[], months = 6, now = new Date()): MonthCategoryTotals[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(toISODate(shiftMonth(now, -i)).slice(0, 7));
  const buckets = new Map(keys.map((k) => [k, emptyCategoryRecord()]));
  for (const e of expenses) {
    const bucket = buckets.get(monthKey(e.date));
    if (bucket) bucket[e.category] += cents(e.amount);
  }
  return keys.map((month) => {
    const raw = buckets.get(month) ?? emptyCategoryRecord();
    const byCategory = emptyCategoryRecord();
    let total = 0;
    for (const c of CATEGORIES) {
      byCategory[c] = raw[c] / 100;
      total += raw[c];
    }
    return { month, total: total / 100, byCategory };
  });
}

// ---------------------------------------------------------------------------
// Daily totals with a rolling average
// ---------------------------------------------------------------------------

export interface RollingDayPoint {
  date: string;
  total: number;
  /** Mean of the trailing `window` days ending on this date (always a full window). */
  average: number;
}

/** Daily totals for the last `days` days, each with the trailing `window`-day average. */
export function rollingDailyAverage(expenses: Expense[], days = 30, window = 7, now = new Date()): RollingDayPoint[] {
  const span = Math.max(1, window);
  const all = totalsByDay(expenses, days + span - 1, now).map((d) => ({ date: d.date, cents: cents(d.total) }));
  const out: RollingDayPoint[] = [];
  let running = 0;
  for (let i = 0; i < all.length; i++) {
    running += all[i].cents;
    if (i >= span) running -= all[i - span].cents;
    if (i >= span - 1) {
      out.push({ date: all[i].date, total: all[i].cents / 100, average: Math.round(running / span) / 100 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weekday averages
// ---------------------------------------------------------------------------

export interface WeekdayAverage {
  /** 0 = Monday … 6 = Sunday. */
  index: number;
  weekday: (typeof WEEKDAY_LABELS)[number];
  name: (typeof WEEKDAY_NAMES)[number];
  total: number;
  /** Number of times this weekday occurred in the period. */
  days: number;
  /** Mean spend per occurrence of this weekday (days with no spending count as 0). */
  average: number;
}

/**
 * Average spend per weekday (Mon..Sun) over the last `months` calendar months, ending today.
 * The period starts on the first day of the month `months - 1` months ago.
 */
export function weekdayAverages(expenses: Expense[], now = new Date(), months = 3): WeekdayAverage[] {
  const start = shiftMonth(now, -(Math.max(1, months) - 1));
  const startISO = toISODate(start);
  const endISO = toISODate(now);
  const totals = Array<number>(7).fill(0);
  const days = Array<number>(7).fill(0);
  for (let d = new Date(start); toISODate(d) <= endISO; d.setDate(d.getDate() + 1)) {
    days[(d.getDay() + 6) % 7] += 1;
  }
  for (const e of expenses) {
    if (e.date < startISO || e.date > endISO) continue;
    totals[weekdayIndex(e.date)] += cents(e.amount);
  }
  return WEEKDAY_LABELS.map((weekday, index) => ({
    index,
    weekday,
    name: WEEKDAY_NAMES[index],
    total: totals[index] / 100,
    days: days[index],
    average: days[index] > 0 ? Math.round(totals[index] / days[index]) / 100 : 0,
  }));
}

// ---------------------------------------------------------------------------
// Category month-over-month
// ---------------------------------------------------------------------------

export interface CategoryChange {
  category: Category;
  thisMonth: number;
  lastMonth: number;
  /** thisMonth - lastMonth, in dollars. */
  change: number;
  /** Fractional change (0.25 = +25%), or null when there was no spending last month. */
  percent: number | null;
}

/** This month versus last month per category. Categories with no spending in either month are omitted. */
export function categoryMonthOverMonth(expenses: Expense[], now = new Date()): CategoryChange[] {
  const thisKey = toISODate(now).slice(0, 7);
  const lastKey = toISODate(shiftMonth(now, -1)).slice(0, 7);
  const current = emptyCategoryRecord();
  const previous = emptyCategoryRecord();
  for (const e of expenses) {
    const k = monthKey(e.date);
    if (k === thisKey) current[e.category] += cents(e.amount);
    else if (k === lastKey) previous[e.category] += cents(e.amount);
  }
  return CATEGORIES.filter((c) => current[c] > 0 || previous[c] > 0)
    .map((category) => {
      const thisMonth = current[category] / 100;
      const lastMonth = previous[category] / 100;
      const change = (current[category] - previous[category]) / 100;
      return { category, thisMonth, lastMonth, change, percent: lastMonth > 0 ? change / lastMonth : null };
    })
    .sort((a, b) => b.thisMonth - a.thisMonth || b.lastMonth - a.lastMonth);
}

// ---------------------------------------------------------------------------
// Frequent descriptions
// ---------------------------------------------------------------------------

export interface DescriptionFrequency {
  /** Display label: the first-seen spelling of the description. */
  description: string;
  count: number;
  total: number;
  average: number;
}

function normalizeDescription(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Most frequent descriptions (case- and whitespace-insensitive), by count then total. */
export function topDescriptions(expenses: Expense[], limit = 5): DescriptionFrequency[] {
  const groups = new Map<string, { description: string; count: number; cents: number }>();
  for (const e of expenses) {
    const key = normalizeDescription(e.description);
    if (!key) continue;
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      g.cents += cents(e.amount);
    } else {
      groups.set(key, { description: e.description.trim().replace(/\s+/g, " "), count: 1, cents: cents(e.amount) });
    }
  }
  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count || b.cents - a.cents || a.description.localeCompare(b.description))
    .slice(0, Math.max(0, limit))
    .map((g) => ({ description: g.description, count: g.count, total: g.cents / 100, average: Math.round(g.cents / g.count) / 100 }));
}

// ---------------------------------------------------------------------------
// Plain-English insights
// ---------------------------------------------------------------------------

export type InsightTone = "up" | "down" | "neutral";

export interface Insight {
  id: string;
  /** "up" = spending is rising (a warning), "down" = spending is falling (good news), "neutral" = informational. */
  tone: InsightTone;
  title: string;
  detail: string;
}

const MIN_INSIGHTS = 3;
const MAX_INSIGHTS = 6;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Current run of days with no spending ending today, and the longest run within the window. */
export function noSpendStreaks(expenses: Expense[], days = 30, now = new Date()): { current: number; longest: number } {
  const daily = totalsByDay(expenses, days, now);
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const d of daily) {
    run = d.total > 0 ? 0 : run + 1;
    longest = Math.max(longest, run);
  }
  for (let i = daily.length - 1; i >= 0 && daily[i].total === 0; i--) current += 1;
  return { current, longest };
}

/** Builds 3 to 6 insights from the expense history. Returns [] when there are no expenses. */
export function generateInsights(expenses: Expense[], now = new Date()): Insight[] {
  if (expenses.length === 0) return [];
  const out: Insight[] = [];
  const todayISO = toISODate(now);
  const thisKey = todayISO.slice(0, 7);
  const lastKey = toISODate(shiftMonth(now, -1)).slice(0, 7);
  const thisMonthItems = expenses.filter((e) => monthKey(e.date) === thisKey);
  const lastMonthItems = expenses.filter((e) => monthKey(e.date) === lastKey);
  const thisMonthTotal = sumAmounts(thisMonthItems);
  const lastMonthTotal = sumAmounts(lastMonthItems);

  // 1 + 2. Biggest category increase and decrease versus last month.
  const changes = categoryMonthOverMonth(expenses, now).filter((c) => c.lastMonth > 0 && Math.abs(c.change) >= 0.01);
  const rising = changes.filter((c) => c.change > 0).sort((a, b) => b.change - a.change)[0];
  const falling = changes.filter((c) => c.change < 0).sort((a, b) => a.change - b.change)[0];
  if (rising) {
    out.push({
      id: "category-up",
      tone: "up",
      title: `${rising.category} is up ${formatPercent(rising.percent ?? 0)} on last month`,
      detail: `${formatCurrency(rising.thisMonth)} so far this month, compared with ${formatCurrency(rising.lastMonth)} for all of last month.`,
    });
  }
  if (falling) {
    out.push({
      id: "category-down",
      tone: "down",
      title: `${falling.category} is down ${formatPercent(Math.abs(falling.percent ?? 0))} on last month`,
      detail: `${formatCurrency(falling.thisMonth)} so far this month, compared with ${formatCurrency(falling.lastMonth)} last month.`,
    });
  }

  // 3. Projected month-end spend from the daily average so far.
  if (thisMonthTotal > 0) {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const perDay = Math.round(cents(thisMonthTotal) / dayOfMonth);
    const projected = (perDay * daysInMonth) / 100;
    const tone: InsightTone = lastMonthTotal > 0 ? (projected > lastMonthTotal ? "up" : projected < lastMonthTotal ? "down" : "neutral") : "neutral";
    const comparison =
      lastMonthTotal > 0
        ? `${tone === "up" ? "above" : tone === "down" ? "below" : "level with"} last month's ${formatCurrency(lastMonthTotal)}`
        : "nothing recorded last month to compare against";
    out.push({
      id: "projection",
      tone,
      title: `On track to spend about ${formatCurrency(projected)} this month`,
      detail: `Averaging ${formatCurrency(perDay / 100)} a day over ${plural(dayOfMonth, "day")} so far, ${comparison}.`,
    });
  }

  // 4. Most expensive day in the last 90 days (falling back to all time).
  const recentCutoff = toISODate(shiftDay(now, -89));
  const recent = expenses.filter((e) => e.date >= recentCutoff && e.date <= todayISO);
  const pool = recent.length ? recent : expenses;
  const byDay = new Map<string, { cents: number; count: number }>();
  for (const e of pool) {
    const d = byDay.get(e.date) ?? { cents: 0, count: 0 };
    d.cents += cents(e.amount);
    d.count += 1;
    byDay.set(e.date, d);
  }
  const priciest = Array.from(byDay.entries()).sort((a, b) => b[1].cents - a[1].cents || b[0].localeCompare(a[0]))[0];
  if (priciest) {
    out.push({
      id: "priciest-day",
      tone: "neutral",
      title: `${formatDate(priciest[0])} was your most expensive day${recent.length ? " recently" : ""}`,
      detail: `${formatCurrency(priciest[1].cents / 100)} across ${plural(priciest[1].count, "expense")}${recent.length ? " in the last 90 days" : ""}.`,
    });
  }

  // 5. Weekday you spend the most on.
  const weekdays = weekdayAverages(expenses, now, 3);
  const spent = weekdays.filter((w) => w.total > 0);
  if (spent.length >= 2) {
    const top = [...spent].sort((a, b) => b.average - a.average)[0];
    const others = weekdays.filter((w) => w.index !== top.index);
    const otherDays = others.reduce((acc, w) => acc + w.days, 0);
    const otherAvg = otherDays > 0 ? others.reduce((acc, w) => acc + cents(w.total), 0) / otherDays / 100 : 0;
    out.push({
      id: "weekday",
      tone: "neutral",
      title: `${top.name}s are your biggest spending day`,
      detail: `You average ${formatCurrency(top.average)} on a ${top.name}, against ${formatCurrency(otherAvg)} on other days over the last 3 months.`,
    });
  }

  // 6. No-spend streak.
  const streaks = noSpendStreaks(expenses, 30, now);
  if (streaks.current >= 2) {
    out.push({
      id: "streak",
      tone: "down",
      title: `${plural(streaks.current, "day")} without spending`,
      detail: `Your current no-spend streak, counting today. Keep it going.`,
    });
  } else if (streaks.longest >= 3) {
    out.push({
      id: "streak",
      tone: "neutral",
      title: `Longest no-spend streak: ${plural(streaks.longest, "day")}`,
      detail: `The longest run of days without any spending in the last 30 days.`,
    });
  }

  // Fallbacks so there are always at least three insights.
  if (out.length < MIN_INSIGHTS) {
    const scope = thisMonthItems.length ? thisMonthItems : expenses;
    const top = totalsByCategory(scope)[0];
    if (top) {
      out.push({
        id: "top-category",
        tone: "neutral",
        title: `${top.category} makes up ${formatPercent(top.share)} of your spending`,
        detail: `${formatCurrency(top.total)} across ${plural(top.count, "expense")} ${thisMonthItems.length ? "this month" : "overall"}.`,
      });
    }
  }
  if (out.length < MIN_INSIGHTS) {
    const frequent = topDescriptions(expenses, 1)[0];
    if (frequent && frequent.count >= 2) {
      out.push({
        id: "frequent",
        tone: "neutral",
        title: `"${frequent.description}" is your most frequent expense`,
        detail: `Logged ${plural(frequent.count, "time")} for ${formatCurrency(frequent.total)} in total, about ${formatCurrency(frequent.average)} each.`,
      });
    }
  }
  if (out.length < MIN_INSIGHTS) {
    out.push({
      id: "total",
      tone: "neutral",
      title: `${plural(expenses.length, "expense")} logged so far`,
      detail: `${formatCurrency(sumAmounts(expenses))} in total. Insights get sharper as you add more.`,
    });
  }

  return out.slice(0, MAX_INSIGHTS);
}
