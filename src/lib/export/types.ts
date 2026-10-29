export type ExportFormat = "csv" | "json" | "pdf";

/** Which list is being exported: the expenses currently shown (filters applied) or every expense. */
export type ExportScope = "filtered" | "all";

export type ExportColumn = "date" | "category" | "description" | "amount";

export interface ExportOptions {
  format: ExportFormat;
  /** Recorded in the output metadata; the caller passes whichever list the scope refers to. */
  scope: ExportScope;
  /** Append totals by category to the export. */
  includeSummary: boolean;
  /** Columns to include. Order is always Date, Category, Description, Amount; omit for all four. */
  columns?: ExportColumn[];
}

export interface ExportResult {
  content: string | Uint8Array;
  mimeType: string;
  filename: string;
}

export const ALL_COLUMNS: readonly ExportColumn[] = ["date", "category", "description", "amount"];

export const COLUMN_LABELS: Record<ExportColumn, string> = {
  date: "Date",
  category: "Category",
  description: "Description",
  amount: "Amount",
};

export const FORMAT_LABELS: Record<ExportFormat, string> = { csv: "CSV", json: "JSON", pdf: "PDF" };

/** Narrows the column list to known columns in canonical order; an empty or missing list means all columns. */
export function resolveColumns(columns?: ExportColumn[]): ExportColumn[] {
  const chosen = columns?.length ? ALL_COLUMNS.filter((c) => columns.includes(c)) : ALL_COLUMNS;
  return chosen.length ? [...chosen] : [...ALL_COLUMNS];
}
