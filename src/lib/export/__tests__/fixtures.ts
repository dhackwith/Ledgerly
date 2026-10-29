import type { Category, Expense } from "@/lib/types";

export function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount" | "category">): Expense {
  return {
    id: partial.id ?? `${partial.date}-${partial.amount}`,
    description: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

export const SAMPLE: Expense[] = [
  expense({ id: "a", date: "2026-10-01", amount: 10.1, category: "Food", description: "Lunch" }),
  expense({ id: "b", date: "2026-10-05", amount: 0.2, category: "Food", description: "Gum" }),
  expense({ id: "c", date: "2026-09-20", amount: 50, category: "Bills", description: "Power" }),
];

/** N expenses with distinct descriptions "Expense #1" ... "Expense #N". */
export function manyExpenses(n: number): Expense[] {
  const categories: Category[] = ["Food", "Transportation", "Entertainment", "Shopping", "Bills", "Other"];
  return Array.from({ length: n }, (_, i) =>
    expense({
      id: `e${i + 1}`,
      date: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
      amount: (i + 1) * 1.25,
      category: categories[i % categories.length],
      description: `Expense #${i + 1}`,
    }),
  );
}

export const FIXED_NOW = new Date(2026, 9, 28, 14, 30, 0); // Oct 28, 2026, local time
