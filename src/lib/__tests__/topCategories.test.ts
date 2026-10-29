import { describe, expect, it } from "vitest";
import { CATEGORIES, type Expense } from "@/lib/types";
import { isCountable, periodRange, rankCategories, topCategories } from "@/lib/topCategories";

function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount" | "category">): Expense {
  return { id: partial.id ?? `${partial.date}-${partial.amount}-${partial.category}`, description: "x", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...partial };
}

const NOW = new Date(2026, 9, 28); // Oct 28, 2026

describe("periodRange", () => {
  it("covers whole calendar months and years", () => {
    expect(periodRange("month", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("3months", NOW)).toEqual({ from: "2026-08-01", to: "2026-10-31" });
    expect(periodRange("year", NOW)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange("all", NOW)).toEqual({ from: null, to: null });
  });
  it("crosses the year boundary for the 3-month window", () => {
    expect(periodRange("3months", new Date(2026, 0, 15))).toEqual({ from: "2025-11-01", to: "2026-01-31" });
  });
  it("handles February in a leap year", () => {
    expect(periodRange("month", new Date(2028, 1, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("rankCategories", () => {
  it("returns nothing for empty input", () => {
    expect(rankCategories([])).toEqual([]);
  });

  it("ranks a single category at 100%", () => {
    const rows = rankCategories([
      expense({ date: "2026-10-01", amount: 10.1, category: "Food" }),
      expense({ date: "2026-10-02", amount: 0.2, category: "Food" }),
    ]);
    expect(rows).toEqual([{ category: "Food", total: 10.3, count: 2, share: 1, rank: 1 }]);
  });

  it("sorts by total, highest first", () => {
    const rows = rankCategories([
      expense({ date: "2026-10-01", amount: 5, category: "Food" }),
      expense({ date: "2026-10-01", amount: 50, category: "Bills" }),
      expense({ date: "2026-10-01", amount: 20, category: "Shopping" }),
    ]);
    expect(rows.map((r) => [r.rank, r.category])).toEqual([
      [1, "Bills"],
      [2, "Shopping"],
      [3, "Food"],
    ]);
  });

  it("breaks ties on expense count, then canonical category order", () => {
    const rows = rankCategories([
      expense({ date: "2026-10-01", amount: 30, category: "Other" }),
      expense({ date: "2026-10-01", amount: 30, category: "Bills" }),
      expense({ date: "2026-10-01", amount: 15, category: "Food" }),
      expense({ date: "2026-10-02", amount: 15, category: "Food" }),
    ]);
    // Food has more expenses; Bills comes before Other in CATEGORIES.
    expect(rows.map((r) => r.category)).toEqual(["Food", "Bills", "Other"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("is independent of input order", () => {
    const items = [
      expense({ date: "2026-10-01", amount: 30, category: "Other" }),
      expense({ date: "2026-10-01", amount: 30, category: "Bills" }),
      expense({ date: "2026-10-01", amount: 30, category: "Entertainment" }),
    ];
    const forward = rankCategories(items).map((r) => r.category);
    const reversed = rankCategories([...items].reverse()).map((r) => r.category);
    expect(forward).toEqual(["Entertainment", "Bills", "Other"]);
    expect(reversed).toEqual(forward);
  });

  it("ignores non-finite, zero, negative and non-numeric amounts", () => {
    const rows = rankCategories([
      expense({ date: "2026-10-01", amount: 10, category: "Food" }),
      expense({ date: "2026-10-01", amount: NaN, category: "Food" }),
      expense({ date: "2026-10-01", amount: Infinity, category: "Bills" }),
      expense({ date: "2026-10-01", amount: -Infinity, category: "Bills" }),
      expense({ date: "2026-10-01", amount: 0, category: "Shopping" }),
      expense({ date: "2026-10-01", amount: -5, category: "Shopping" }),
      expense({ date: "2026-10-01", amount: "12" as unknown as number, category: "Other" }),
    ]);
    expect(rows).toEqual([{ category: "Food", total: 10, count: 1, share: 1, rank: 1 }]);
  });
});

describe("isCountable", () => {
  it("rejects unknown categories", () => {
    expect(isCountable(expense({ date: "2026-10-01", amount: 5, category: "Pets" as never }))).toBe(false);
    expect(isCountable(expense({ date: "2026-10-01", amount: 5, category: "Food" }))).toBe(true);
  });
});

describe("topCategories", () => {
  const data: Expense[] = [
    expense({ date: "2026-07-31", amount: 100, category: "Bills" }), // just before the 3-month window
    expense({ date: "2026-08-01", amount: 40, category: "Food" }), // first day of the 3-month window
    expense({ date: "2026-09-30", amount: 25, category: "Shopping" }), // day before this month
    expense({ date: "2026-10-01", amount: 10, category: "Food" }), // first day of this month
    expense({ date: "2026-10-31", amount: 5.55, category: "Transportation" }), // last day of this month
    expense({ date: "2025-12-31", amount: 999, category: "Other" }), // last year
  ];

  it("returns an empty result for empty input", () => {
    const result = topCategories([], "all", NOW);
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
    expect(result.unused).toEqual([...CATEGORIES]);
  });

  it("treats both ends of this month as inclusive", () => {
    const result = topCategories(data, "month", NOW);
    expect(result.rows.map((r) => r.category)).toEqual(["Food", "Transportation"]);
    expect(result.total).toBe(15.55);
    expect(result.count).toBe(2);
  });

  it("includes the first day of the 3-month window but not the day before", () => {
    const result = topCategories(data, "3months", NOW);
    expect(result.rows.map((r) => [r.category, r.total])).toEqual([
      ["Food", 50],
      ["Shopping", 25],
      ["Transportation", 5.55],
    ]);
  });

  it("limits this year to the current calendar year", () => {
    const result = topCategories(data, "year", NOW);
    expect(result.rows.map((r) => r.category)).toEqual(["Bills", "Food", "Shopping", "Transportation"]);
    expect(result.total).toBe(180.55);
  });

  it("includes everything for all time", () => {
    const result = topCategories(data, "all", NOW);
    expect(result.rows[0]).toMatchObject({ rank: 1, category: "Other", total: 999 });
    expect(result.count).toBe(data.length);
  });

  it("returns empty rows when the period has no spending", () => {
    const result = topCategories([expense({ date: "2024-03-01", amount: 12, category: "Food" })], "month", NOW);
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.unused).toHaveLength(CATEGORIES.length);
  });

  it("lists categories with no spend separately, in canonical order", () => {
    const result = topCategories(data, "month", NOW);
    expect(result.unused).toEqual(["Entertainment", "Shopping", "Bills", "Other"]);
  });

  it("has shares that sum to 1 and totals that add up to the period total", () => {
    const items = [
      expense({ date: "2026-10-01", amount: 33.33, category: "Food" }),
      expense({ date: "2026-10-02", amount: 33.33, category: "Bills" }),
      expense({ date: "2026-10-03", amount: 33.34, category: "Shopping" }),
      expense({ date: "2026-10-04", amount: 0.1, category: "Other" }),
      expense({ date: "2026-10-05", amount: 0.2, category: "Other" }),
    ];
    const result = topCategories(items, "month", NOW);
    const shareSum = result.rows.reduce((acc, r) => acc + r.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);
    const centSum = result.rows.reduce((acc, r) => acc + Math.round(r.total * 100), 0);
    expect(centSum / 100).toBe(result.total);
    expect(result.total).toBe(100.3);
    for (const r of result.rows) {
      expect(r.share).toBeGreaterThan(0);
      expect(r.share).toBeLessThanOrEqual(1);
    }
  });

  it("does not count invalid amounts toward the period total", () => {
    const result = topCategories(
      [
        expense({ date: "2026-10-01", amount: 20, category: "Food" }),
        expense({ date: "2026-10-01", amount: NaN, category: "Bills" }),
        expense({ date: "2026-10-01", amount: Infinity, category: "Bills" }),
      ],
      "month",
      NOW,
    );
    expect(result.total).toBe(20);
    expect(result.count).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].share).toBe(1);
  });
});
