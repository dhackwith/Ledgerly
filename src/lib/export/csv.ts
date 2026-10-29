import type { Expense } from "@/lib/types";
import { sumAmounts, totalsByCategory } from "@/lib/analytics";
import { formatPercent } from "@/lib/format";
import { COLUMN_LABELS, resolveColumns, type ExportColumn, type ExportOptions } from "./types";

/** Byte-order mark that makes Excel read the file as UTF-8. */
export const CSV_BOM = "﻿";

/** Rows are joined with CRLF, which every spreadsheet app accepts. */
export const CSV_EOL = "\r\n";

export function escapeCell(value: string): string {
  // Guard against formula injection when the file is opened in a spreadsheet app.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CELL: Record<ExportColumn, (e: Expense) => string> = {
  date: (e) => e.date,
  category: (e) => e.category,
  description: (e) => e.description,
  amount: (e) => e.amount.toFixed(2),
};

function toRow(cells: string[]): string {
  return cells.map(escapeCell).join(",");
}

/** The expense table alone: a header row plus one row per expense. No BOM. */
export function expensesToCSV(expenses: Expense[], columns?: ExportColumn[]): string {
  const cols = resolveColumns(columns);
  const header = cols.map((c) => COLUMN_LABELS[c]);
  const rows = expenses.map((e) => cols.map((c) => CELL[c](e)));
  return [header, ...rows].map(toRow).join(CSV_EOL);
}

/** Totals by category with a grand total row. */
export function summaryToCSV(expenses: Expense[]): string {
  const header = ["Category", "Expenses", "Total", "Share"];
  const rows = totalsByCategory(expenses).map((c) => [c.category, String(c.count), c.total.toFixed(2), formatPercent(c.share)]);
  const total = ["Total", String(expenses.length), sumAmounts(expenses).toFixed(2), expenses.length ? "100%" : "0%"];
  return [header, ...rows, total].map(toRow).join(CSV_EOL);
}

/** Full file contents: BOM, the expense table and, when asked, a blank line followed by the category summary. */
export function buildCSV(expenses: Expense[], options: Pick<ExportOptions, "includeSummary" | "columns">): string {
  const sections = [expensesToCSV(expenses, options.columns)];
  if (options.includeSummary) sections.push("", summaryToCSV(expenses));
  return CSV_BOM + sections.join(CSV_EOL);
}
