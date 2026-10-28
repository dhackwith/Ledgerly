import type { Expense } from "@/lib/types";
import { EXPORT_COLUMNS, type ExportColumn } from "./types";

export interface ColumnDef {
  key: ExportColumn;
  label: string;
  align: "left" | "right";
  /** Plain value used by text formats. Amounts keep two decimals and no currency symbol. */
  text: (e: Expense) => string;
}

export const COLUMN_DEFS: Record<ExportColumn, ColumnDef> = {
  date: { key: "date", label: "Date", align: "left", text: (e) => e.date },
  category: { key: "category", label: "Category", align: "left", text: (e) => e.category },
  amount: { key: "amount", label: "Amount", align: "right", text: (e) => e.amount.toFixed(2) },
  description: { key: "description", label: "Description", align: "left", text: (e) => e.description },
};

/** Selected columns in their canonical order, whatever order they were toggled in. */
export function orderedColumns(selected: readonly ExportColumn[]): ColumnDef[] {
  return EXPORT_COLUMNS.filter((c) => selected.includes(c)).map((c) => COLUMN_DEFS[c]);
}
