import type { Expense, ExpenseMeta, SuggestionRecord } from "@/lib/types";

export const SUGGESTION: SuggestionRecord = { category: "Food", confidence: 0.82, shown: "preselected", accepted: true, modelVersion: "test-model-1" };

export const FULL_META: ExpenseMeta = { source: "manual", suggestion: SUGGESTION, recategorizedAt: "2026-10-10T12:00:00.000Z" };

export function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e1",
    date: "2026-10-03",
    amount: 12.5,
    category: "Food",
    description: "Lunch",
    createdAt: "2026-10-03T12:00:00.000Z",
    updatedAt: "2026-10-03T12:00:00.000Z",
    ...overrides,
  };
}
