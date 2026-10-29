import type { Category, Expense, SuggestionDisplay } from "@/lib/types";
import type { SuggestionResult } from "@/lib/ml/contract";

export const TEST_MODEL_VERSION = "test-1";

/** Builds an engine result; `confidence` is the first probability. */
export function suggestion(
  display: SuggestionDisplay,
  ranked: Array<[Category, number]>,
  reason: string | null = null,
): SuggestionResult {
  return {
    ranked: ranked.map(([category, p]) => ({ category, p })),
    confidence: ranked[0]?.[1] ?? 0,
    display,
    reason,
    modelVersion: TEST_MODEL_VERSION,
  };
}

export function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e1",
    date: "2026-10-01",
    amount: 18.4,
    category: "Food",
    description: "uber",
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}
