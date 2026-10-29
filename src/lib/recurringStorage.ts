import { CATEGORIES, type RecurringRule } from "./types";
import { FREQUENCIES, MAX_INTERVAL, MIN_INTERVAL } from "./recurring";

export const RECURRING_STORAGE_KEY = "expense-tracker:recurring:v1";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isISODate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

function isValidRule(value: unknown): value is RecurringRule {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.description === "string" &&
    typeof r.amount === "number" &&
    Number.isFinite(r.amount) &&
    typeof r.category === "string" &&
    (CATEGORIES as readonly string[]).includes(r.category) &&
    typeof r.frequency === "string" &&
    (FREQUENCIES as readonly string[]).includes(r.frequency) &&
    typeof r.interval === "number" &&
    Number.isInteger(r.interval) &&
    r.interval >= MIN_INTERVAL &&
    r.interval <= MAX_INTERVAL &&
    isISODate(r.startDate) &&
    (r.endDate === undefined || isISODate(r.endDate)) &&
    isISODate(r.nextDate) &&
    typeof r.active === "boolean"
  );
}

/**
 * Turns previously parsed JSON into a list of rules, dropping malformed records.
 * Throws if the value is not a list at all.
 */
export function parseRules(raw: unknown): RecurringRule[] {
  if (!Array.isArray(raw)) throw new Error("Stored recurring data is not a list.");
  const now = new Date().toISOString();
  return raw.filter(isValidRule).map((r) => ({
    ...r,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : now,
  }));
}

/** Reads recurring rules from localStorage. Throws if storage is unavailable or the data is corrupt. */
export function loadRules(): RecurringRule[] {
  const raw = window.localStorage.getItem(RECURRING_STORAGE_KEY);
  if (!raw) return [];
  return parseRules(JSON.parse(raw));
}

/** Writes recurring rules to localStorage. Throws on quota or access errors. */
export function saveRules(rules: RecurringRule[]): void {
  window.localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(rules));
}
