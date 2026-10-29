import { describe, expect, it } from "vitest";
import {
  budgetProgress,
  budgetState,
  budgetSummary,
  countLimits,
  daysInMonth,
  nearLimitCategories,
  overLimitCategories,
  projectedMonthEnd,
} from "@/lib/budgets";
import { parseBudgets } from "@/lib/budgetStorage";
import type { Expense } from "@/lib/types";

function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount" | "category">): Expense {
  return {
    id: partial.id ?? `${partial.date}-${partial.category}-${partial.amount}`,
    description: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

// Wednesday 2026-10-28, well inside October (31 days).
const now = new Date(2026, 9, 28);

describe("budgetState", () => {
  it("maps ratios to states with inclusive 80% and exclusive 100%", () => {
    expect(budgetState(0)).toBe("ok");
    expect(budgetState(0.799)).toBe("ok");
    expect(budgetState(0.8)).toBe("near");
    expect(budgetState(1)).toBe("near");
    expect(budgetState(1.0001)).toBe("over");
  });
});

describe("budgetProgress", () => {
  it("only reports categories with a limit and computes remaining and ratio", () => {
    const expenses = [
      expense({ date: "2026-10-03", amount: 50, category: "Food" }),
      expense({ date: "2026-10-10", amount: 25, category: "Bills" }),
    ];
    const rows = budgetProgress(expenses, { Food: 200 }, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ category: "Food", limit: 200, spent: 50, remaining: 150, ratio: 0.25, state: "ok" });
  });

  it("sums in whole cents so float drift does not leak into remaining", () => {
    const expenses = [
      expense({ date: "2026-10-01", amount: 0.1, category: "Food" }),
      expense({ date: "2026-10-02", amount: 0.2, category: "Food" }),
      expense({ date: "2026-10-03", amount: 0.3, category: "Food" }),
    ];
    const [row] = budgetProgress(expenses, { Food: 1 }, now);
    expect(row.spent).toBe(0.6);
    expect(row.remaining).toBe(0.4);
    expect(row.ratio).toBeCloseTo(0.6, 10);
  });

  it("only counts the calendar month containing `now`", () => {
    const expenses = [
      expense({ date: "2026-09-30", amount: 500, category: "Food" }),
      expense({ date: "2026-10-01", amount: 10, category: "Food" }),
      expense({ date: "2026-10-31", amount: 15, category: "Food" }),
      expense({ date: "2026-11-01", amount: 500, category: "Food" }),
    ];
    const [row] = budgetProgress(expenses, { Food: 100 }, now);
    expect(row.spent).toBe(25);
    const [sept] = budgetProgress(expenses, { Food: 100 }, new Date(2026, 8, 1));
    expect(sept.spent).toBe(500);
  });

  it("sorts over, then near, then ok, each by ratio descending", () => {
    const expenses = [
      expense({ date: "2026-10-05", amount: 120, category: "Food" }), // 120% over
      expense({ date: "2026-10-05", amount: 90, category: "Bills" }), // 90% near
      expense({ date: "2026-10-05", amount: 10, category: "Shopping" }), // 10% ok
      expense({ date: "2026-10-05", amount: 150, category: "Transportation" }), // 150% over
      expense({ date: "2026-10-05", amount: 50, category: "Entertainment" }), // 50% ok
    ];
    const limits = { Food: 100, Bills: 100, Shopping: 100, Transportation: 100, Entertainment: 100, Other: 100 };
    const rows = budgetProgress(expenses, limits, now);
    expect(rows.map((r) => `${r.category}:${r.state}`)).toEqual([
      "Transportation:over",
      "Food:over",
      "Bills:near",
      "Entertainment:ok",
      "Shopping:ok",
      "Other:ok",
    ]);
  });

  it("ignores zero or negative limits", () => {
    expect(budgetProgress([], { Food: 0, Bills: -5 }, now)).toEqual([]);
  });
});

describe("budgetSummary", () => {
  it("totals budgeted and spent and counts each state", () => {
    const expenses = [
      expense({ date: "2026-10-05", amount: 120, category: "Food" }),
      expense({ date: "2026-10-05", amount: 85, category: "Bills" }),
      expense({ date: "2026-10-05", amount: 10.1, category: "Shopping" }),
    ];
    const rows = budgetProgress(expenses, { Food: 100, Bills: 100, Shopping: 100.2 }, now);
    const summary = budgetSummary(rows);
    expect(summary.budgeted).toBe(300.2);
    expect(summary.spent).toBe(215.1);
    expect(summary.remaining).toBe(85.1);
    expect(summary.ratio).toBeCloseTo(215.1 / 300.2, 10);
    expect(summary.counts).toEqual({ over: 1, near: 1, ok: 1 });
  });

  it("returns zeros with no budgets", () => {
    expect(budgetSummary([])).toEqual({ budgeted: 0, spent: 0, remaining: 0, ratio: 0, counts: { ok: 0, near: 0, over: 0 } });
  });
});

describe("projectedMonthEnd", () => {
  it("extrapolates the daily average across the month", () => {
    const expenses = [
      expense({ date: "2026-10-01", amount: 100, category: "Food" }),
      expense({ date: "2026-10-09", amount: 100, category: "Food" }),
      expense({ date: "2026-10-09", amount: 999, category: "Bills" }),
    ];
    // $200 over 10 days = $20/day × 31 days = $620.
    expect(projectedMonthEnd(expenses, "Food", new Date(2026, 9, 10))).toBe(620);
    expect(projectedMonthEnd(expenses, "Other", new Date(2026, 9, 10))).toBe(0);
  });

  it("uses the actual number of days in the month", () => {
    expect(daysInMonth(new Date(2026, 1, 1))).toBe(28);
    expect(daysInMonth(new Date(2028, 1, 1))).toBe(29);
    const expenses = [expense({ date: "2026-02-01", amount: 7, category: "Food" })];
    expect(projectedMonthEnd(expenses, "Food", new Date(2026, 1, 7))).toBe(28);
  });
});

describe("overLimitCategories / nearLimitCategories", () => {
  it("lists the categories in each state", () => {
    const expenses = [
      expense({ date: "2026-10-05", amount: 120, category: "Food" }),
      expense({ date: "2026-10-05", amount: 85, category: "Bills" }),
    ];
    const rows = budgetProgress(expenses, { Food: 100, Bills: 100, Other: 100 }, now);
    expect(overLimitCategories(rows)).toEqual(["Food"]);
    expect(nearLimitCategories(rows)).toEqual(["Bills"]);
  });
});

describe("countLimits", () => {
  it("counts set categories", () => {
    expect(countLimits({})).toBe(0);
    expect(countLimits({ Food: 1, Other: 2 })).toBe(2);
  });
});

describe("parseBudgets", () => {
  it("keeps valid limits and rounds to cents", () => {
    expect(parseBudgets({ Food: 300, Bills: 99.999 })).toEqual({ Food: 300, Bills: 100 });
  });

  it("drops unknown categories and invalid numbers", () => {
    expect(
      parseBudgets({ Food: 100, Pets: 50, Bills: -1, Shopping: Infinity, Other: "20", Entertainment: NaN, Transportation: 0 }),
    ).toEqual({ Food: 100 });
  });

  it("throws on non-object input", () => {
    expect(() => parseBudgets([])).toThrow();
    expect(() => parseBudgets(null)).toThrow();
    expect(() => parseBudgets("nope")).toThrow();
  });
});
