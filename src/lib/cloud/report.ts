// A Report is the neutral result of running a template. Every destination
// (file, spreadsheet, email, share link) renders from this one structure.

import type { Category } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export type TemplateId = "monthly-summary" | "category-analysis" | "tax-report" | "full-backup";

export type ColumnKind = "text" | "money" | "count" | "percent" | "date";
export type Cell = string | number;

export interface ReportTable {
  title: string;
  columns: string[];
  kinds: ColumnKind[];
  rows: Cell[][];
  total?: Cell[];
  /** Transaction-level detail, left out when only totals are shared. */
  detail?: boolean;
}

export interface ReportMetric {
  label: string;
  value: string;
  hint?: string;
}

/** The fields of an expense that travel with a report. Ids and timestamps stay private. */
export interface PortableExpense {
  date: string;
  category: Category;
  amount: number;
  description: string;
}

export interface Report {
  template: TemplateId;
  title: string;
  period: string;
  generatedAt: string;
  metrics: ReportMetric[];
  tables: ReportTable[];
  notes: string[];
  recordCount: number;
  total: number;
  expenses?: PortableExpense[];
}

/** Removes transaction-level tables and raw expenses, keeping only totals. */
export function totalsOnly(report: Report): Report {
  return { ...report, tables: report.tables.filter((t) => !t.detail), expenses: undefined };
}

export function displayCell(value: Cell, kind: ColumnKind): string {
  if (typeof value === "string") return value;
  switch (kind) {
    case "money":
      return formatCurrency(value);
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "count":
      return value.toLocaleString("en-US");
    default:
      return String(value);
  }
}

/** Plain value for spreadsheets: numbers stay numbers, percents keep a % sign so Sheets and Excel parse them. */
function plainCell(value: Cell, kind: ColumnKind): string {
  if (typeof value === "string") return value;
  if (kind === "money") return value.toFixed(2);
  if (kind === "percent") return `${(value * 100).toFixed(1)}%`;
  return String(value);
}

// Signed numbers and percentages such as "+12%" or "-3.50" are data, not formulas.
const SIGNED_NUMBER = /^[+-]?\d[\d.,]*%?$/;

function escapeCsv(value: string): string {
  // Neutralize cells a spreadsheet would run as a formula.
  const safe = /^[=+\-@\t\r]/.test(value) && !SIGNED_NUMBER.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function escapeTsv(value: string): string {
  const safe = /^[=+\-@]/.test(value) && !SIGNED_NUMBER.test(value) ? `'${value}` : value;
  return safe.replace(/[\t\r\n]+/g, " ");
}

function tableLines(t: ReportTable, escape: (v: string) => string, sep: string): string[] {
  const line = (cells: Cell[]) => cells.map((c, i) => escape(plainCell(c, t.kinds[i] ?? "text"))).join(sep);
  return [escape(t.title), t.columns.map(escape).join(sep), ...t.rows.map(line), ...(t.total ? [line(t.total)] : [])];
}

/** One CSV file with a small header block, then each table separated by a blank line. */
export function toCsv(report: Report): string {
  const head = [escapeCsv(report.title), escapeCsv(report.period), `Generated,${report.generatedAt}`];
  const body = report.tables.flatMap((t) => ["", ...tableLines(t, escapeCsv, ",")]);
  return String.fromCharCode(0xfeff) + [...head, ...body].join("\r\n") + "\r\n";
}

/** Tab-separated text that pastes straight into Google Sheets, Excel or Numbers as cells. */
export function toTsv(report: Report): string {
  return report.tables.map((t) => tableLines(t, escapeTsv, "\t").join("\n")).join("\n\n");
}

export function toJson(report: Report): string {
  return JSON.stringify({ app: "Ledgerly", schemaVersion: 1, ...report }, null, 2) + "\n";
}

/** A short plain-text digest for email bodies and chat messages. */
export function toDigest(report: Report): string {
  const lines = [`${report.title} · ${report.period}`, ""];
  for (const m of report.metrics) lines.push(`${m.label}: ${m.value}`);
  const first = report.tables.find((t) => !t.detail);
  if (first) {
    lines.push("", `${first.title}:`);
    for (const row of first.rows.slice(0, 6)) {
      const moneyCol = first.kinds.indexOf("money");
      lines.push(`  • ${row[0]}${moneyCol > 0 ? ` — ${displayCell(row[moneyCol], "money")}` : ""}`);
    }
  }
  lines.push("", "Made with Ledgerly");
  return lines.join("\n");
}

export type FileFormat = "csv" | "json";

export function serialize(report: Report, format: FileFormat): { text: string; mime: string; extension: string } {
  return format === "json"
    ? { text: toJson(report), mime: "application/json", extension: "json" }
    : { text: toCsv(report), mime: "text/csv;charset=utf-8", extension: "csv" };
}

/** "1 expense", "3 expenses". */
export function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

export function byteSize(text: string): number {
  return new Blob([text]).size;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function reportFilename(report: Report, extension: string): string {
  return `ledgerly-${slugify(`${report.title} ${report.period}`)}.${extension}`;
}
