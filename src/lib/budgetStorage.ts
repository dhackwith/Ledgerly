import { CATEGORIES, type Category } from "./types";
import type { BudgetLimits } from "./budgets";

export const BUDGETS_STORAGE_KEY = "expense-tracker:budgets:v1";

/**
 * Turns untrusted parsed JSON into valid budget limits. Unknown categories and
 * non-finite, zero or negative values are dropped; amounts are rounded to cents.
 * Throws if the value is not a plain object, so corrupt data surfaces as an error.
 */
export function parseBudgets(raw: unknown): BudgetLimits {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Stored budget data is not an object.");
  const record = raw as Record<string, unknown>;
  const limits: BudgetLimits = {};
  for (const category of CATEGORIES) {
    const value = record[category];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    limits[category as Category] = Math.round(value * 100) / 100;
  }
  return limits;
}

/** Reads budget limits from localStorage. Throws if storage is unavailable or the data is corrupt. */
export function loadBudgets(): BudgetLimits {
  const raw = window.localStorage.getItem(BUDGETS_STORAGE_KEY);
  if (!raw) return {};
  return parseBudgets(JSON.parse(raw));
}

/** Writes budget limits to localStorage. Throws on quota or access errors. */
export function saveBudgets(limits: BudgetLimits): void {
  window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(limits));
}
