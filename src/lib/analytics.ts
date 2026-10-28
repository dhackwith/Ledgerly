import { CATEGORIES, type Category, type Expense, type ExpenseFilters, type ExpenseInput, type SortKey } from "./types";
import { monthKey, toISODate } from "./format";

export function filterExpenses(expenses: Expense[], f: ExpenseFilters): Expense[] {
  const q = f.search.trim().toLowerCase();
  return expenses.filter((e) => {
    if (f.category !== "All" && e.category !== f.category) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (q && !e.description.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortExpenses(expenses: Expense[], sort: SortKey): Expense[] {
  const copy = [...expenses];
  copy.sort((a, b) => {
    switch (sort) {
      case "date-asc":
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      case "amount-desc":
        return b.amount - a.amount;
      case "amount-asc":
        return a.amount - b.amount;
      case "date-desc":
      default:
        return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    }
  });
  return copy;
}

/** Sums in whole cents to avoid floating-point drift. */
export function sumAmounts(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + Math.round(e.amount * 100), 0) / 100;
}

export interface CategoryTotal {
  category: Category;
  total: number;
  count: number;
  share: number;
}

export function totalsByCategory(expenses: Expense[]): CategoryTotal[] {
  const grand = sumAmounts(expenses);
  return CATEGORIES.map((category) => {
    const items = expenses.filter((e) => e.category === category);
    const total = sumAmounts(items);
    return { category, total, count: items.length, share: grand > 0 ? total / grand : 0 };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.total - a.total);
}

export interface MonthTotal {
  month: string;
  total: number;
}

/** Totals for the last `months` calendar months, including empty months. */
export function totalsByMonth(expenses: Expense[], months = 6, now = new Date()): MonthTotal[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(toISODate(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
  }
  const cents = new Map(keys.map((k) => [k, 0]));
  for (const e of expenses) {
    const k = monthKey(e.date);
    if (cents.has(k)) cents.set(k, (cents.get(k) ?? 0) + Math.round(e.amount * 100));
  }
  return keys.map((month) => ({ month, total: (cents.get(month) ?? 0) / 100 }));
}

export interface DayTotal {
  date: string;
  total: number;
}

/** Daily totals for the last `days` days, including empty days. */
export function totalsByDay(expenses: Expense[], days = 30, now = new Date()): DayTotal[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  const cents = new Map(keys.map((k) => [k, 0]));
  for (const e of expenses) {
    if (cents.has(e.date)) cents.set(e.date, (cents.get(e.date) ?? 0) + Math.round(e.amount * 100));
  }
  return keys.map((date) => ({ date, total: (cents.get(date) ?? 0) / 100 }));
}

export interface DashboardStats {
  total: number;
  count: number;
  thisMonth: number;
  thisMonthCount: number;
  lastMonth: number;
  monthChange: number | null;
  avgPerDayThisMonth: number;
  topCategory: CategoryTotal | null;
  topCategoryIsThisMonth: boolean;
  largest: Expense | null;
}

export function computeStats(expenses: Expense[], now = new Date()): DashboardStats {
  const thisKey = toISODate(now).slice(0, 7);
  const lastKey = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const thisMonthItems = expenses.filter((e) => monthKey(e.date) === thisKey);
  const thisMonth = sumAmounts(thisMonthItems);
  const lastMonth = sumAmounts(expenses.filter((e) => monthKey(e.date) === lastKey));
  const largest = expenses.reduce<Expense | null>((max, e) => (!max || e.amount > max.amount ? e : max), null);
  const topThisMonth = totalsByCategory(thisMonthItems)[0] ?? null;
  return {
    total: sumAmounts(expenses),
    count: expenses.length,
    thisMonth,
    thisMonthCount: thisMonthItems.length,
    lastMonth,
    monthChange: lastMonth > 0 ? (thisMonth - lastMonth) / lastMonth : null,
    avgPerDayThisMonth: thisMonth / now.getDate(),
    topCategory: topThisMonth ?? totalsByCategory(expenses)[0] ?? null,
    topCategoryIsThisMonth: topThisMonth !== null,
    largest,
  };
}

/** Realistic sample data spread across the last ~4 months, for trying the app out. */
export function buildSampleExpenses(now = new Date()): ExpenseInput[] {
  const templates: Array<[Category, string, number, number]> = [
    ["Food", "Grocery run", 45, 120],
    ["Food", "Lunch with coworkers", 12, 28],
    ["Food", "Coffee", 4, 7],
    ["Food", "Dinner out", 30, 75],
    ["Transportation", "Gas", 35, 60],
    ["Transportation", "Rideshare", 12, 30],
    ["Transportation", "Transit pass", 25, 25],
    ["Entertainment", "Movie tickets", 18, 32],
    ["Entertainment", "Streaming subscription", 15.99, 15.99],
    ["Entertainment", "Concert", 45, 90],
    ["Shopping", "New shoes", 60, 110],
    ["Shopping", "Household supplies", 20, 55],
    ["Shopping", "Books", 15, 40],
    ["Bills", "Electricity bill", 80, 130],
    ["Bills", "Internet", 65, 65],
    ["Bills", "Phone plan", 45, 45],
    ["Other", "Gift for a friend", 25, 70],
    ["Other", "Haircut", 30, 45],
  ];
  // Seeded pseudo-random generator so the sample is the same every time.
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const out: ExpenseInput[] = [];
  for (let i = 0; i < 90; i++) {
    const [category, description, min, max] = templates[Math.floor(rand() * templates.length)];
    const daysAgo = Math.floor(rand() * 175);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    out.push({
      date: toISODate(d),
      amount: Math.round((min + rand() * (max - min)) * 100) / 100,
      category,
      description,
    });
  }
  return out;
}
