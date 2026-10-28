import { CATEGORIES } from "@/lib/types";
import { orderedColumns } from "../columns";
import type { ExportWriter } from "../types";

/** Self-describing JSON: metadata, applied filters, a summary, then the records. */
export const writeJson: ExportWriter = ({ rows, summary, options, generatedAt }) => {
  const columns = orderedColumns(options.columns);
  const allCategories = options.categories.length === CATEGORIES.length;
  const document = {
    meta: {
      app: "Ledgerly",
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      currency: "USD",
      columns: columns.map((c) => c.key),
      filters: {
        from: options.from || null,
        to: options.to || null,
        categories: allCategories ? "all" : options.categories,
        keyword: options.keyword.trim() || null,
      },
      sort: options.sort,
    },
    summary: {
      count: summary.count,
      total: summary.total,
      average: summary.average,
      firstDate: summary.firstDate,
      lastDate: summary.lastDate,
      byCategory: summary.byCategory.map(({ category, count, total }) => ({ category, count, total })),
    },
    expenses: rows.map((e) =>
      Object.fromEntries(columns.map((c) => [c.key, c.key === "amount" ? Math.round(e.amount * 100) / 100 : c.text(e)])),
    ),
  };
  return new Blob([JSON.stringify(document, null, 2) + "\n"], { type: "application/json" });
};
