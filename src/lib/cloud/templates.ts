import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import { sortExpenses, sumAmounts } from "@/lib/analytics";
import { formatCurrency, formatDate, formatMonthKey, monthKey, parseLocalDate, toISODate } from "@/lib/format";
import type { Cell, PortableExpense, Report, ReportTable, TemplateId } from "./report";

export interface TemplateParams {
  /** YYYY-MM, for the monthly summary. */
  month?: string;
  /** Look-back window for the category analysis. */
  months?: 3 | 6 | 12;
  /** Calendar year, for the tax report. */
  year?: number;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  tagline: string;
  audience: string;
  accent: string;
  defaultParams: (expenses: Expense[], now: Date) => TemplateParams;
  describe: (params: TemplateParams) => string;
  build: (expenses: Expense[], params: TemplateParams, now: Date) => Report;
}

const portable = (list: Expense[]): PortableExpense[] =>
  sortExpenses(list, "date-asc").map(({ date, category, amount, description }) => ({ date, category, amount, description }));

const cents = (n: number) => Math.round(n * 100) / 100;
const pctChange = (now: number, before: number) => (before > 0 ? (now - before) / before : null);
const signedPct = (v: number | null) => (v === null ? "new" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`);

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(toISODate(new Date(y, m - 1 + delta, 1)));
}

function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function byCategory(list: Expense[]): Map<Category, Expense[]> {
  const map = new Map<Category, Expense[]>(CATEGORIES.map((c) => [c, []]));
  for (const e of list) map.get(e.category)!.push(e);
  return map;
}

function transactionsTable(list: Expense[], title = "Transactions"): ReportTable {
  const rows = sortExpenses(list, "date-asc").map((e): Cell[] => [e.date, e.category, e.description, e.amount]);
  return {
    title,
    columns: ["Date", "Category", "Description", "Amount"],
    kinds: ["date", "text", "text", "money"],
    rows,
    total: ["Total", "", "", sumAmounts(list)],
    detail: true,
  };
}

// --- Monthly summary --------------------------------------------------------

const monthlySummary: TemplateDef = {
  id: "monthly-summary",
  name: "Monthly Summary",
  tagline: "One month at a glance, compared with the month before.",
  audience: "Households, partners, check-ins",
  accent: "#2648e0",
  defaultParams: (_expenses, now) => {
    // Early in a month, last month is the one people want to send.
    const current = monthKey(toISODate(now));
    return { month: now.getDate() <= 7 ? shiftMonth(current, -1) : current };
  },
  describe: (p) => formatMonthKey(p.month ?? "", "long"),
  build: (expenses, p, now) => {
    const month = p.month ?? monthKey(toISODate(now));
    const prev = shiftMonth(month, -1);
    const inMonth = expenses.filter((e) => monthKey(e.date) === month);
    const inPrev = expenses.filter((e) => monthKey(e.date) === prev);
    const total = sumAmounts(inMonth);
    const prevTotal = sumAmounts(inPrev);
    const isCurrent = month === monthKey(toISODate(now));
    const days = isCurrent ? now.getDate() : daysInMonth(month);

    const cur = byCategory(inMonth);
    const before = byCategory(inPrev);
    const categoryRows = CATEGORIES.map((c): Cell[] => {
      const t = sumAmounts(cur.get(c)!);
      const b = sumAmounts(before.get(c)!);
      return [c, cur.get(c)!.length, t, total > 0 ? t / total : 0, cents(t - b)];
    })
      .filter((r) => (r[1] as number) > 0 || (r[4] as number) !== 0)
      .sort((a, b) => (b[2] as number) - (a[2] as number));

    const weeks = new Map<string, Expense[]>();
    for (const e of inMonth) {
      const d = parseLocalDate(e.date);
      const start = toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
      weeks.set(start, [...(weeks.get(start) ?? []), e]);
    }

    const top = [...inMonth].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const change = pctChange(total, prevTotal);
    const label = formatMonthKey(month, "long");

    return {
      template: "monthly-summary",
      title: "Monthly Summary",
      period: label,
      generatedAt: now.toISOString(),
      metrics: [
        { label: "Total spent", value: formatCurrency(total) },
        { label: "Transactions", value: inMonth.length.toLocaleString("en-US") },
        { label: "Daily average", value: formatCurrency(days ? total / days : 0), hint: `${days} days` },
        {
          label: `vs ${formatMonthKey(prev, "long").split(" ")[0]}`,
          value: change === null ? "—" : signedPct(change),
          hint: `${formatCurrency(prevTotal)} last month`,
        },
      ],
      tables: [
        {
          title: "Spending by category",
          columns: ["Category", "Transactions", "Total", "Share", "Change vs last month"],
          kinds: ["text", "count", "money", "percent", "money"],
          rows: categoryRows,
          total: ["Total", inMonth.length, total, total > 0 ? 1 : 0, cents(total - prevTotal)],
        },
        {
          title: "Week by week",
          columns: ["Week of", "Transactions", "Total"],
          kinds: ["date", "count", "money"],
          rows: Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([w, list]) => [w, list.length, sumAmounts(list)]),
        },
        {
          title: "Largest expenses",
          columns: ["Date", "Category", "Description", "Amount"],
          kinds: ["date", "text", "text", "money"],
          rows: top.map((e) => [e.date, e.category, e.description, e.amount]),
          detail: true,
        },
        transactionsTable(inMonth, "All transactions"),
      ],
      notes: isCurrent ? [`${label} is still in progress. Figures cover the 1st through ${formatDate(toISODate(now))}.`] : [],
      recordCount: inMonth.length,
      total,
      expenses: portable(inMonth),
    };
  },
};

// --- Category analysis ------------------------------------------------------

const categoryAnalysis: TemplateDef = {
  id: "category-analysis",
  name: "Category Analysis",
  tagline: "Where the money goes over time, and which categories are growing.",
  audience: "Budget planning, spotting trends",
  accent: "#1baf7a",
  defaultParams: () => ({ months: 6 }),
  describe: (p) => `Last ${p.months ?? 6} months`,
  build: (expenses, p, now) => {
    const n = p.months ?? 6;
    const last = monthKey(toISODate(now));
    const keys = Array.from({ length: n }, (_, i) => shiftMonth(last, i - n + 1));
    const inRange = expenses.filter((e) => keys.includes(monthKey(e.date)));
    const total = sumAmounts(inRange);
    const groups = byCategory(inRange);
    const half = Math.floor(n / 2);
    const recentKeys = new Set(keys.slice(n - half));
    const olderKeys = new Set(keys.slice(0, half));

    const overview = CATEGORIES.map((c) => {
      const list = groups.get(c)!;
      const t = sumAmounts(list);
      const recent = sumAmounts(list.filter((e) => recentKeys.has(monthKey(e.date))));
      const older = sumAmounts(list.filter((e) => olderKeys.has(monthKey(e.date))));
      return { c, count: list.length, t, recent, older, trend: pctChange(recent, older) };
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.t - a.t);

    const growing = overview.filter((r) => r.trend !== null && r.older > 0).sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))[0];

    const matrix = keys.map((k): Cell[] => {
      const month = inRange.filter((e) => monthKey(e.date) === k);
      const per = byCategory(month);
      return [formatMonthKey(k, "long"), ...CATEGORIES.map((c) => sumAmounts(per.get(c)!)), sumAmounts(month)];
    });

    return {
      template: "category-analysis",
      title: "Category Analysis",
      period: `${formatMonthKey(keys[0], "long")} – ${formatMonthKey(last, "long")}`,
      generatedAt: now.toISOString(),
      metrics: [
        { label: "Total", value: formatCurrency(total) },
        { label: "Monthly average", value: formatCurrency(total / n) },
        { label: "Biggest category", value: overview[0]?.c ?? "—", hint: overview[0] ? formatCurrency(overview[0].t) : undefined },
        {
          label: "Fastest growing",
          value: growing && (growing.trend ?? 0) > 0 ? growing.c : "—",
          hint: growing && (growing.trend ?? 0) > 0 ? `${signedPct(growing.trend)} recent vs earlier` : "Nothing is growing",
        },
      ],
      tables: [
        {
          title: "Category overview",
          columns: ["Category", "Transactions", "Total", "Share", "Avg per month", "Avg per transaction", `Trend (last ${half} vs prior ${half} mo)`],
          kinds: ["text", "count", "money", "percent", "money", "money", "text"],
          rows: overview.map((r) => [r.c, r.count, r.t, total > 0 ? r.t / total : 0, cents(r.t / n), cents(r.t / r.count), signedPct(r.trend)]),
          total: ["Total", inRange.length, total, total > 0 ? 1 : 0, cents(total / n), inRange.length ? cents(total / inRange.length) : 0, ""],
        },
        {
          title: "Month by category",
          columns: ["Month", ...CATEGORIES, "Total"],
          kinds: ["text", ...CATEGORIES.map(() => "money" as const), "money"],
          rows: matrix,
        },
      ],
      notes: [],
      recordCount: inRange.length,
      total,
      expenses: portable(inRange),
    };
  },
};

// --- Tax report -------------------------------------------------------------

const taxReport: TemplateDef = {
  id: "tax-report",
  name: "Tax Report",
  tagline: "A full-year ledger with quarterly totals, ready for your accountant.",
  audience: "Accountants, tax season",
  accent: "#e87ba4",
  defaultParams: (_e, now) => ({ year: now.getMonth() <= 3 ? now.getFullYear() - 1 : now.getFullYear() }),
  describe: (p) => `Tax year ${p.year}`,
  build: (expenses, p, now) => {
    const year = p.year ?? now.getFullYear();
    const inYear = expenses.filter((e) => e.date.startsWith(`${year}-`));
    const total = sumAmounts(inYear);
    const quarter = (e: Expense) => Math.floor((Number(e.date.slice(5, 7)) - 1) / 3);
    const groups = byCategory(inYear);
    const rows = CATEGORIES.map((c): Cell[] => {
      const list = groups.get(c)!;
      const q = [0, 1, 2, 3].map((i) => sumAmounts(list.filter((e) => quarter(e) === i)));
      return [c, ...q, sumAmounts(list), list.length];
    }).filter((r) => (r[6] as number) > 0);
    const qTotals = [0, 1, 2, 3].map((i) => sumAmounts(inYear.filter((e) => quarter(e) === i)));
    const top = rows.slice().sort((a, b) => (b[5] as number) - (a[5] as number))[0];
    const months = new Set(inYear.map((e) => monthKey(e.date))).size;
    const inProgress = year === now.getFullYear();

    return {
      template: "tax-report",
      title: "Tax Report",
      period: `Tax year ${year}`,
      generatedAt: now.toISOString(),
      metrics: [
        { label: "Total expenses", value: formatCurrency(total) },
        { label: "Transactions", value: inYear.length.toLocaleString("en-US") },
        { label: "Largest category", value: top ? String(top[0]) : "—", hint: top ? formatCurrency(top[5] as number) : undefined },
        { label: "Months with spending", value: `${months} of 12` },
      ],
      tables: [
        {
          title: "Quarterly totals by category",
          columns: ["Category", "Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)", "Year total", "Transactions"],
          kinds: ["text", "money", "money", "money", "money", "money", "count"],
          rows,
          total: ["Total", ...qTotals, total, inYear.length],
        },
        transactionsTable(inYear, "Itemized ledger"),
      ],
      notes: [
        "Ledgerly doesn't know which expenses are tax-deductible. Review each item with a tax professional.",
        ...(inProgress ? [`${year} isn't over yet, so this report covers spending through ${formatDate(toISODate(now))}.`] : []),
      ],
      recordCount: inYear.length,
      total,
      expenses: portable(inYear),
    };
  },
};

// --- Full backup ------------------------------------------------------------

const fullBackup: TemplateDef = {
  id: "full-backup",
  name: "Full Backup",
  tagline: "Every expense, in a file Ledgerly can restore or import.",
  audience: "Backups, moving devices",
  accent: "#eb6834",
  defaultParams: () => ({}),
  describe: () => "All expenses",
  build: (expenses, _p, now) => {
    const sorted = sortExpenses(expenses, "date-asc");
    const total = sumAmounts(expenses);
    return {
      template: "full-backup",
      title: "Full Backup",
      period: sorted.length ? `${formatDate(sorted[0].date)} – ${formatDate(sorted[sorted.length - 1].date)}` : "No expenses",
      generatedAt: now.toISOString(),
      metrics: [
        { label: "Expenses", value: expenses.length.toLocaleString("en-US") },
        { label: "Total", value: formatCurrency(total) },
        { label: "Categories used", value: String(new Set(expenses.map((e) => e.category)).size) },
      ],
      tables: [transactionsTable(expenses)],
      notes: ["Import this JSON file from Share & sync → Backups to restore it, on this device or another."],
      recordCount: expenses.length,
      total,
      expenses: portable(expenses),
    };
  },
};

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  "monthly-summary": monthlySummary,
  "category-analysis": categoryAnalysis,
  "tax-report": taxReport,
  "full-backup": fullBackup,
};

export const TEMPLATE_ORDER: TemplateId[] = ["monthly-summary", "category-analysis", "tax-report", "full-backup"];

/** Months and years that actually contain expenses, newest first, for parameter pickers. */
export function availablePeriods(expenses: Expense[], now: Date) {
  const months = new Set(expenses.map((e) => monthKey(e.date)));
  months.add(monthKey(toISODate(now)));
  const years = new Set(expenses.map((e) => Number(e.date.slice(0, 4))));
  years.add(now.getFullYear());
  return {
    months: Array.from(months).sort().reverse(),
    years: Array.from(years).sort((a, b) => b - a),
  };
}

export function buildReport(id: TemplateId, expenses: Expense[], params: TemplateParams, now = new Date()): Report {
  const def = TEMPLATES[id];
  return def.build(expenses, { ...def.defaultParams(expenses, now), ...params }, now);
}
