import type { Category, Expense, SortKey } from "@/lib/types";
import type { CategoryTotal } from "@/lib/analytics";

export const EXPORT_FORMATS = ["csv", "json", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_COLUMNS = ["date", "category", "amount", "description"] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/** Everything the user can choose in the export dialog. */
export interface ExportOptions {
  format: ExportFormat;
  /** Inclusive local dates, YYYY-MM-DD. Empty string means unbounded. */
  from: string;
  to: string;
  /** Categories to include. Always at least one when valid. */
  categories: Category[];
  /** Optional case-insensitive text match on description or category. */
  keyword: string;
  columns: ExportColumn[];
  sort: SortKey;
  /** File name without extension. */
  filename: string;
}

export interface ExportSummary {
  count: number;
  total: number;
  average: number;
  /** Earliest and latest expense dates in the selection, or null when empty. */
  firstDate: string | null;
  lastDate: string | null;
  byCategory: CategoryTotal[];
}

/** The resolved selection that every format writer receives. */
export interface ExportDataset {
  rows: Expense[];
  summary: ExportSummary;
  options: ExportOptions;
  generatedAt: Date;
}

/** A format writer turns a dataset into file contents. */
export type ExportWriter = (dataset: ExportDataset) => Blob;

export interface ExportResult {
  blob: Blob;
  filename: string;
  format: ExportFormat;
  count: number;
  bytes: number;
  total: number;
}
