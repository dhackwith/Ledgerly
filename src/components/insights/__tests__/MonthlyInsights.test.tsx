import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BudgetStreak } from "@/lib/budgets";
import { monthSnapshot } from "@/lib/insights";
import type { Expense } from "@/lib/types";
import { MonthlyInsights, type MonthlyInsightsProps } from "../MonthlyInsights";

function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount" | "category">): Expense {
  return {
    id: partial.id ?? `${partial.date}-${partial.category}-${partial.amount}`,
    description: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const now = new Date(2026, 9, 28);
const snapshot = monthSnapshot(
  [
    expense({ date: "2026-10-02", amount: 420, category: "Food" }),
    expense({ date: "2026-10-03", amount: 180, category: "Transportation" }),
    expense({ date: "2026-10-04", amount: 95, category: "Entertainment" }),
    expense({ date: "2026-10-05", amount: 60, category: "Shopping" }),
  ],
  now,
);

function render(props: Partial<MonthlyInsightsProps> = {}): string {
  const streak: BudgetStreak = { current: 12, longest: 20, overToday: [] };
  const html = renderToStaticMarkup(
    <MonthlyInsights snapshot={snapshot} streak={streak} budgetsStatus="ready" restartsOn="2026-11-01" {...props} />,
  );
  // Strip tags so assertions read like the rendered text.
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("MonthlyInsights", () => {
  it("shows the heading, month and spending total", () => {
    const text = render();
    expect(text).toContain("Monthly Insights");
    expect(text).toContain("October 2026");
    expect(text).toContain("Spending $755.00");
  });

  it("lists only the top three categories with their amounts, largest first", () => {
    const text = render();
    expect(text).toContain("Top 3 categories");
    const food = text.indexOf("Food $420.00");
    const transport = text.indexOf("Transportation $180.00");
    const entertainment = text.indexOf("Entertainment $95.00");
    expect(food).toBeGreaterThan(-1);
    expect(transport).toBeGreaterThan(food);
    expect(entertainment).toBeGreaterThan(transport);
    expect(text).not.toContain("Shopping");
  });

  it("shows the current streak and progress toward the best", () => {
    const text = render();
    expect(text).toContain("Budget streak 12 days");
    expect(text).toContain("Best: 20 days");
    expect(text).toContain("Toward your best");
  });

  it("says when the current streak is the best", () => {
    const text = render({ streak: { current: 1, longest: 1, overToday: [] } });
    expect(text).toContain("1 day");
    expect(text).toContain("Your best streak yet");
  });

  it("explains a broken streak and when it restarts", () => {
    const text = render({ streak: { current: 0, longest: 9, overToday: ["Food", "Bills"] } });
    expect(text).toContain("0 days");
    expect(text).toContain("Food, Bills are over budget this month. Your streak restarts on Nov 1.");
  });

  it("asks for a budget when none is set", () => {
    const html = renderToStaticMarkup(
      <MonthlyInsights snapshot={snapshot} streak={null} budgetsStatus="ready" restartsOn="2026-11-01" />,
    );
    expect(html).toContain('href="/budgets"');
    expect(html).toContain("Set budgets");
  });

  it("reports a budget load failure instead of a streak", () => {
    expect(render({ budgetsStatus: "error" })).toContain("Budgets couldn&#x27;t be loaded");
  });

  it("shows an empty message for a month with no spending", () => {
    const text = render({ snapshot: monthSnapshot([], now) });
    expect(text).toContain("No spending recorded yet this month.");
    expect(text).not.toContain("Top 3 categories");
  });
});
