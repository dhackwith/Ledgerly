// Provenance and suggestion details kept on each expense (Expense.meta).
// Meta stays on this device: exports and share links are built from
// PortableExpense, which never includes it.

import { CATEGORIES, type Expense, type ExpenseInput, type ExpenseMeta, type ExpenseSource, type SuggestionRecord } from "./types";

const SOURCES: readonly ExpenseSource[] = ["manual", "import", "shared-import", "sample"];
const DISPLAYS: readonly string[] = ["preselected", "chips", "none"];

export const DEFAULT_META: ExpenseMeta = { source: "manual" };

/** Rebuilds a stored suggestion from known fields, or returns undefined if any field is malformed. */
export function sanitizeSuggestion(value: unknown): SuggestionRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const s = value as Record<string, unknown>;
  if (
    typeof s.category !== "string" ||
    !(CATEGORIES as readonly string[]).includes(s.category) ||
    typeof s.confidence !== "number" ||
    !Number.isFinite(s.confidence) ||
    s.confidence < 0 ||
    s.confidence > 1 ||
    typeof s.shown !== "string" ||
    !DISPLAYS.includes(s.shown) ||
    typeof s.accepted !== "boolean" ||
    typeof s.modelVersion !== "string"
  ) {
    return undefined;
  }
  return {
    category: s.category as SuggestionRecord["category"],
    confidence: s.confidence,
    shown: s.shown as SuggestionRecord["shown"],
    accepted: s.accepted,
    modelVersion: s.modelVersion,
  };
}

/**
 * Rebuilds stored meta from known fields. Meta without a known source is dropped.
 * A malformed suggestion or timestamp is dropped on its own, so the source (which
 * keeps sample data out of learning) survives.
 */
export function sanitizeMeta(value: unknown): ExpenseMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const m = value as Record<string, unknown>;
  if (typeof m.source !== "string" || !(SOURCES as readonly string[]).includes(m.source)) return undefined;
  const meta: ExpenseMeta = { source: m.source as ExpenseSource };
  const suggestion = sanitizeSuggestion(m.suggestion);
  if (suggestion) meta.suggestion = suggestion;
  if (typeof m.recategorizedAt === "string" && !Number.isNaN(Date.parse(m.recategorizedAt))) meta.recategorizedAt = m.recategorizedAt;
  return meta;
}

/** Merges a patch into existing meta (default source "manual"). Undefined patch values are ignored. */
export function mergeMeta(existing: ExpenseMeta | undefined, patch: Partial<ExpenseMeta> | undefined, recategorizedAt?: string): ExpenseMeta {
  const next: ExpenseMeta = { ...DEFAULT_META, ...existing };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value;
  }
  if (recategorizedAt) next.recategorizedAt = recategorizedAt;
  return next;
}

/** Applies an edit. `recategorizedAt` is set only when the category actually changed. */
export function applyUpdate(expense: Expense, input: ExpenseInput, patch: Partial<ExpenseMeta> | undefined, now: string): Expense {
  const changed = input.category !== expense.category;
  return { ...expense, ...input, updatedAt: now, meta: mergeMeta(expense.meta, patch, changed ? now : undefined) };
}
