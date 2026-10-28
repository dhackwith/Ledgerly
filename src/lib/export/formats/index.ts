import type { ExportFormat, ExportWriter } from "../types";

export interface FormatInfo {
  id: ExportFormat;
  label: string;
  extension: string;
  description: string;
  /** Loaded on demand so the writers stay out of the main bundle. */
  load: () => Promise<ExportWriter>;
}

export const FORMATS: Record<ExportFormat, FormatInfo> = {
  csv: {
    id: "csv",
    label: "CSV",
    extension: "csv",
    description: "Spreadsheets like Excel, Numbers and Google Sheets",
    load: () => import("./csv").then((m) => m.writeCsv),
  },
  json: {
    id: "json",
    label: "JSON",
    extension: "json",
    description: "Structured data with a summary, for scripts and other apps",
    load: () => import("./json").then((m) => m.writeJson),
  },
  pdf: {
    id: "pdf",
    label: "PDF",
    extension: "pdf",
    description: "A formatted report with totals, ready to print or share",
    load: () => import("./pdf").then((m) => m.writePdf),
  },
};
