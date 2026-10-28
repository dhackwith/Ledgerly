import { orderedColumns } from "../columns";
import type { ExportWriter } from "../types";

function escapeCell(value: string): string {
  // Spreadsheet apps run cells that start with these characters as formulas.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const writeCsv: ExportWriter = ({ rows, options }) => {
  const columns = orderedColumns(options.columns);
  const lines = [
    columns.map((c) => c.label).join(","),
    // Amounts are plain numbers, so they are never treated as formulas even when negative-looking.
    ...rows.map((e) => columns.map((c) => (c.key === "amount" ? c.text(e) : escapeCell(c.text(e)))).join(",")),
  ];
  // The byte-order mark makes Excel open the file as UTF-8.
  const BOM = String.fromCharCode(0xfeff);
  return new Blob([BOM + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
};
