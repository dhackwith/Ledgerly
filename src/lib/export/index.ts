import type { Expense } from "@/lib/types";
import { toISODate } from "@/lib/format";
import { buildCSV } from "./csv";
import { buildJSON } from "./json";
import { buildPDF } from "./pdf";
import type { ExportFormat, ExportOptions, ExportResult } from "./types";

export type { ExportColumn, ExportFormat, ExportOptions, ExportResult, ExportScope } from "./types";
export { ALL_COLUMNS, COLUMN_LABELS, FORMAT_LABELS } from "./types";

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
  pdf: "application/pdf",
};

/** `expenses-YYYY-MM-DD.<format>`, using the local calendar date. */
export function exportFilename(format: ExportFormat, date = new Date()): string {
  return `expenses-${toISODate(date)}.${format}`;
}

/** Builds the file contents for the given expenses without touching the DOM. */
export function buildExport(expenses: Expense[], options: ExportOptions, now = new Date()): ExportResult {
  const content =
    options.format === "csv"
      ? buildCSV(expenses, options)
      : options.format === "json"
        ? buildJSON(expenses, options, now)
        : buildPDF(expenses, options, now);
  return { content, mimeType: MIME_TYPES[options.format], filename: exportFilename(options.format, now) };
}

/** Hands a built export to the browser as a file download. */
export function triggerDownload({ content, mimeType, filename }: ExportResult): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Builds the export and downloads it. Returns the result so callers can report the filename. */
export function downloadExport(expenses: Expense[], options: ExportOptions): ExportResult {
  const result = buildExport(expenses, options);
  triggerDownload(result);
  return result;
}
