import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import type { PortableExpense } from "./report";

function isPortable(v: unknown): v is PortableExpense {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    typeof e.amount === "number" &&
    Number.isFinite(e.amount) &&
    e.amount > 0 &&
    typeof e.category === "string" &&
    (CATEGORIES as readonly string[]).includes(e.category) &&
    typeof e.description === "string"
  );
}

/** Keeps only well-formed expenses and normalizes their fields. */
export function cleanPortable(list: unknown[]): PortableExpense[] {
  return list.filter(isPortable).map((e) => ({
    date: e.date,
    category: e.category as Category,
    amount: Math.round(e.amount * 100) / 100,
    description: e.description.trim().slice(0, 120) || "Imported expense",
  }));
}

/**
 * Reads a backup file: a Ledgerly JSON export (any template that includes
 * expenses) or a plain array of expenses. Throws a readable error otherwise.
 */
export function parseBackup(text: string): PortableExpense[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("That file isn't valid JSON. Choose a JSON file exported from Ledgerly.");
  }
  const list = Array.isArray(data) ? data : (data as { expenses?: unknown })?.expenses;
  if (!Array.isArray(list)) throw new Error("No expenses found. Export a Full Backup as JSON and try again.");
  const clean = cleanPortable(list);
  if (clean.length === 0) throw new Error("The file has no valid expenses to import.");
  return clean;
}

/** Identity used to skip duplicates when merging. */
export function expenseKey(e: Pick<Expense, "date" | "amount" | "category" | "description">): string {
  return `${e.date}|${e.amount.toFixed(2)}|${e.category}|${e.description.trim().toLowerCase()}`;
}

export function splitNew(incoming: PortableExpense[], existing: Expense[]): { fresh: PortableExpense[]; duplicates: number } {
  const seen = new Set(existing.map(expenseKey));
  const fresh: PortableExpense[] = [];
  for (const e of incoming) {
    const key = expenseKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(e);
  }
  return { fresh, duplicates: incoming.length - fresh.length };
}

export function saveFile(text: string, mime: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
