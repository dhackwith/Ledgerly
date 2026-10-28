import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import { sortExpenses, sumAmounts, totalsByCategory } from "@/lib/analytics";
import { todayISO } from "@/lib/format";
import { EXPORT_COLUMNS, type ExportDataset, type ExportOptions, type ExportSummary } from "./types";

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "csv",
  from: "",
  to: "",
  categories: [...CATEGORIES],
  keyword: "",
  columns: [...EXPORT_COLUMNS],
  sort: "date-desc",
  filename: "",
};

/** Applies every filter in the options and returns rows in the chosen order. */
export function selectRows(expenses: Expense[], o: Pick<ExportOptions, "from" | "to" | "categories" | "keyword" | "sort">): Expense[] {
  const wanted = new Set<Category>(o.categories);
  const q = o.keyword.trim().toLowerCase();
  const rows = expenses.filter((e) => {
    if (!wanted.has(e.category)) return false;
    if (o.from && e.date < o.from) return false;
    if (o.to && e.date > o.to) return false;
    if (q && !e.description.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q)) return false;
    return true;
  });
  return sortExpenses(rows, o.sort);
}

export function summarize(rows: Expense[]): ExportSummary {
  const total = sumAmounts(rows);
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  for (const e of rows) {
    if (firstDate === null || e.date < firstDate) firstDate = e.date;
    if (lastDate === null || e.date > lastDate) lastDate = e.date;
  }
  return {
    count: rows.length,
    total,
    average: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0,
    firstDate,
    lastDate,
    byCategory: totalsByCategory(rows),
  };
}

export function buildDataset(expenses: Expense[], options: ExportOptions, generatedAt = new Date()): ExportDataset {
  const rows = selectRows(expenses, options);
  return { rows, summary: summarize(rows), options, generatedAt };
}

/** Counts per category inside the date range and keyword, ignoring the category selection itself. */
export function countByCategory(expenses: Expense[], o: Pick<ExportOptions, "from" | "to" | "keyword">): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const e of selectRows(expenses, { ...o, categories: [...CATEGORIES], sort: "date-desc" })) counts[e.category]++;
  return counts;
}

/** A descriptive default name, e.g. "ledgerly-expenses-2026-10-01-to-2026-10-28". */
export function suggestFilename(o: Pick<ExportOptions, "from" | "to" | "categories">): string {
  const parts = ["ledgerly-expenses"];
  if (o.from && o.to) parts.push(o.from === o.to ? o.from : `${o.from}-to-${o.to}`);
  else if (o.from) parts.push(`from-${o.from}`);
  else if (o.to) parts.push(`to-${o.to}`);
  else parts.push(todayISO());
  if (o.categories.length > 0 && o.categories.length < CATEGORIES.length && o.categories.length <= 2) {
    parts.push(...o.categories.map((c) => c.toLowerCase()));
  }
  return parts.join("-");
}

// Characters that are invalid in file names on Windows, macOS or Linux.
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Returns an error message for an invalid file name, or null when it is fine. */
export function validateFilename(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a file name.";
  if (trimmed.length > 120) return "Keep the file name under 120 characters.";
  if (INVALID_CHARS.test(trimmed)) return 'File names can\'t contain < > : " / \\ | ? or *.';
  if (RESERVED.test(trimmed)) return "That name is reserved by Windows.";
  if (/^\.+$/.test(trimmed)) return "Enter a file name.";
  return null;
}

/** Drops a trailing extension that matches a known format, so "report.csv" becomes "report". */
export function stripKnownExtension(name: string): string {
  return name.replace(/\.(csv|json|pdf)$/i, "");
}

/** Returns a list of problems that block the export. Empty means ready. */
export function validateOptions(o: ExportOptions): string[] {
  const errors: string[] = [];
  if (o.from && o.to && o.from > o.to) errors.push("The start date is after the end date.");
  if (o.categories.length === 0) errors.push("Select at least one category.");
  if (o.columns.length === 0) errors.push("Select at least one column.");
  const fileError = validateFilename(o.filename);
  if (fileError) errors.push(fileError);
  return errors;
}
