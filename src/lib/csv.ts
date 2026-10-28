import type { Expense } from "./types";
import { todayISO } from "./format";

function escapeCell(value: string): string {
  // Guard against formula injection when the file is opened in a spreadsheet app.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function expensesToCSV(expenses: Expense[]): string {
  const header = ["Date", "Category", "Description", "Amount"];
  const rows = expenses.map((e) => [e.date, e.category, escapeCell(e.description), e.amount.toFixed(2)]);
  return [header, ...rows].map((r) => r.join(",")).join("\r\n");
}

export function downloadCSV(expenses: Expense[], filename?: string): void {
  const name = filename ?? `expenses-${todayISO()}.csv`;
  // The byte-order mark makes Excel read the file as UTF-8.
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + expensesToCSV(expenses)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
