import { CATEGORIES, type Expense } from "./types";
import { sanitizeMeta } from "./expenseMeta";

const STORAGE_KEY = "expense-tracker:expenses:v1";

function isValidExpense(value: unknown): value is Expense {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    typeof e.amount === "number" &&
    Number.isFinite(e.amount) &&
    typeof e.category === "string" &&
    (CATEGORIES as readonly string[]).includes(e.category) &&
    typeof e.description === "string"
  );
}

/** Reads expenses from localStorage. Throws if storage is unavailable or the data is corrupt. */
export function loadExpenses(): Expense[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Stored expense data is not a list.");
  // Drop malformed records instead of crashing the whole app.
  return parsed.filter(isValidExpense).map((record) => {
    // Malformed meta is dropped but the expense is kept. Legacy records have no meta.
    const { meta: rawMeta, ...e } = record as Expense & { meta?: unknown };
    const meta = sanitizeMeta(rawMeta);
    return {
      ...e,
      createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
      updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString(),
      ...(meta ? { meta } : {}),
    };
  });
}

/** Writes expenses to localStorage. Throws on quota or access errors. */
export function saveExpenses(expenses: Expense[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
