import { describe, expect, it } from "vitest";
import { filterExpenses, sortExpenses, sumAmounts, totalsByCategory, totalsByMonth } from "@/lib/analytics";
import { EMPTY_FILTERS, type Expense } from "@/lib/types";

function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount" | "category">): Expense {
  return { id: partial.id ?? `${partial.date}-${partial.amount}`, description: "x", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...partial };
}

const data: Expense[] = [
  expense({ date: "2026-10-01", amount: 10.1, category: "Food", description: "Lunch" }),
  expense({ date: "2026-10-05", amount: 0.2, category: "Food", description: "Gum" }),
  expense({ date: "2026-09-20", amount: 50, category: "Bills", description: "Power" }),
];

describe("sumAmounts", () => {
  it("sums in whole cents to avoid float drift", () => {
    expect(sumAmounts(data)).toBe(60.3);
  });
});

describe("filterExpenses", () => {
  it("matches search against description and category", () => {
    expect(filterExpenses(data, { ...EMPTY_FILTERS, search: "lun" })).toHaveLength(1);
    expect(filterExpenses(data, { ...EMPTY_FILTERS, search: "bills" })).toHaveLength(1);
  });
  it("applies an inclusive date range", () => {
    expect(filterExpenses(data, { ...EMPTY_FILTERS, from: "2026-10-01", to: "2026-10-05" })).toHaveLength(2);
  });
});

describe("sortExpenses", () => {
  it("sorts by amount descending", () => {
    expect(sortExpenses(data, "amount-desc").map((e) => e.amount)).toEqual([50, 10.1, 0.2]);
  });
});

describe("totalsByCategory", () => {
  it("drops empty categories and computes share", () => {
    const totals = totalsByCategory(data);
    expect(totals.map((t) => t.category)).toEqual(["Bills", "Food"]);
    expect(totals[0].share).toBeCloseTo(50 / 60.3);
  });
});

describe("totalsByMonth", () => {
  it("includes empty months in the window", () => {
    const totals = totalsByMonth(data, 3, new Date(2026, 9, 28));
    expect(totals).toEqual([
      { month: "2026-08", total: 0 },
      { month: "2026-09", total: 50 },
      { month: "2026-10", total: 10.3 },
    ]);
  });
});
