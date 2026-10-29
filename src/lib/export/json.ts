import type { Category, Expense } from "@/lib/types";
import { sumAmounts, totalsByCategory } from "@/lib/analytics";
import { resolveColumns, type ExportColumn, type ExportOptions, type ExportScope } from "./types";

export interface JSONCategoryTotal {
  category: Category;
  count: number;
  total: number;
  /** Fraction of the grand total, 0 to 1, rounded to four decimals. */
  share: number;
}

export type JSONExpense = { id: string } & Partial<Pick<Expense, ExportColumn>>;

export interface JSONExport {
  /** ISO 8601 timestamp of when the export was generated. */
  exportedAt: string;
  scope: ExportScope;
  count: number;
  /** Grand total in dollars, summed in whole cents. */
  total: number;
  summary?: { byCategory: JSONCategoryTotal[] };
  expenses: JSONExpense[];
}

function pickColumns(e: Expense, cols: ExportColumn[]): JSONExpense {
  const row: JSONExpense = { id: e.id };
  if (cols.includes("date")) row.date = e.date;
  if (cols.includes("category")) row.category = e.category;
  if (cols.includes("description")) row.description = e.description;
  if (cols.includes("amount")) row.amount = e.amount;
  return row;
}

/** The export as a plain object, for callers that want to inspect it rather than serialize it. */
export function buildJSONDocument(
  expenses: Expense[],
  options: Pick<ExportOptions, "scope" | "includeSummary" | "columns">,
  now = new Date(),
): JSONExport {
  const cols = resolveColumns(options.columns);
  const summary = options.includeSummary
    ? {
        byCategory: totalsByCategory(expenses).map((c) => ({
          category: c.category,
          count: c.count,
          total: c.total,
          share: Math.round(c.share * 10000) / 10000,
        })),
      }
    : undefined;
  return {
    exportedAt: now.toISOString(),
    scope: options.scope,
    count: expenses.length,
    total: sumAmounts(expenses),
    ...(summary && { summary }),
    expenses: expenses.map((e) => pickColumns(e, cols)),
  };
}

/** Pretty-printed JSON with a trailing newline. */
export function buildJSON(
  expenses: Expense[],
  options: Pick<ExportOptions, "scope" | "includeSummary" | "columns">,
  now = new Date(),
): string {
  return `${JSON.stringify(buildJSONDocument(expenses, options, now), null, 2)}\n`;
}
