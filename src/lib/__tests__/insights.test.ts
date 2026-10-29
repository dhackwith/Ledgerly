import { describe, expect, it } from "vitest";
import {
  categoryMonthOverMonth,
  generateInsights,
  monthlyByCategory,
  noSpendStreaks,
  rollingDailyAverage,
  topDescriptions,
  weekdayAverages,
  weekdayIndex,
} from "@/lib/insights";
import type { Expense } from "@/lib/types";

function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount" | "category">): Expense {
  return {
    id: partial.id ?? `${partial.date}-${partial.amount}`,
    description: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

// Wednesday 28 October 2026. October 2026 starts on a Thursday.
const now = new Date(2026, 9, 28);

const data: Expense[] = [
  expense({ date: "2026-10-01", amount: 10.1, category: "Food", description: "Lunch" }),
  expense({ date: "2026-10-05", amount: 0.2, category: "Food", description: "Gum" }),
  expense({ date: "2026-10-26", amount: 40, category: "Shopping", description: "Shoes" }),
  expense({ date: "2026-09-20", amount: 50, category: "Bills", description: "Power" }),
  expense({ date: "2026-09-10", amount: 5, category: "Food", description: "  lunch " }),
  expense({ date: "2026-08-15", amount: 30, category: "Transportation", description: "Gas" }),
];

describe("weekdayIndex", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(weekdayIndex("2026-10-26")).toBe(0);
    expect(weekdayIndex("2026-10-25")).toBe(6);
    expect(weekdayIndex("2026-10-01")).toBe(3);
  });
});

describe("monthlyByCategory", () => {
  it("returns every month in the window with per-category totals in cents precision", () => {
    const rows = monthlyByCategory(data, 3, now);
    expect(rows.map((r) => r.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(rows[2].total).toBe(50.3);
    expect(rows[2].byCategory.Food).toBe(10.3);
    expect(rows[2].byCategory.Shopping).toBe(40);
    expect(rows[2].byCategory.Bills).toBe(0);
    expect(rows[1]).toMatchObject({ total: 55, byCategory: { Bills: 50, Food: 5 } });
    expect(rows[0].byCategory.Transportation).toBe(30);
  });
  it("yields zeroed months for empty input", () => {
    const rows = monthlyByCategory([], 2, now);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.total === 0)).toBe(true);
    expect(Object.values(rows[0].byCategory).every((v) => v === 0)).toBe(true);
  });
});

describe("rollingDailyAverage", () => {
  it("computes a full trailing window for every day in range", () => {
    const points = rollingDailyAverage(data, 5, 3, now);
    expect(points.map((p) => p.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]);
    expect(points.map((p) => p.total)).toEqual([0, 0, 40, 0, 0]);
    expect(points.map((p) => p.average)).toEqual([0, 0, 13.33, 13.33, 13.33]);
  });
  it("drops out of the window after `window` days", () => {
    const points = rollingDailyAverage(data, 10, 2, now);
    const byDate = Object.fromEntries(points.map((p) => [p.date, p.average]));
    expect(byDate["2026-10-26"]).toBe(20);
    expect(byDate["2026-10-27"]).toBe(20);
    expect(byDate["2026-10-28"]).toBe(0);
  });
  it("returns zeros for empty input", () => {
    const points = rollingDailyAverage([], 3, 7, now);
    expect(points).toHaveLength(3);
    expect(points.every((p) => p.total === 0 && p.average === 0)).toBe(true);
  });
});

describe("weekdayAverages", () => {
  it("averages over each weekday's occurrences in the period, zero days included", () => {
    const rows = weekdayAverages(data, now, 1); // 1–28 October: four of each weekday
    expect(rows.map((r) => r.weekday)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(rows.every((r) => r.days === 4)).toBe(true);
    expect(rows[0]).toMatchObject({ name: "Monday", total: 40.2, average: 10.05 });
    expect(rows[3]).toMatchObject({ name: "Thursday", total: 10.1, average: 2.53 });
    expect(rows[6].total).toBe(0);
  });
  it("covers whole calendar months back from today", () => {
    const rows = weekdayAverages(data, now, 3); // 1 August – 28 October
    const totalDays = rows.reduce((acc, r) => acc + r.days, 0);
    expect(totalDays).toBe(31 + 30 + 28);
    expect(rows.reduce((acc, r) => acc + r.total, 0)).toBeCloseTo(135.3);
  });
  it("returns all weekdays with zero averages for empty input", () => {
    const rows = weekdayAverages([], now, 2);
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.average === 0 && r.days > 0)).toBe(true);
  });
});

describe("categoryMonthOverMonth", () => {
  it("compares this month with last month per category", () => {
    const rows = categoryMonthOverMonth(data, now);
    expect(rows.map((r) => r.category)).toEqual(["Shopping", "Food", "Bills"]);
    expect(rows[0]).toEqual({ category: "Shopping", thisMonth: 40, lastMonth: 0, change: 40, percent: null });
    expect(rows[1]).toMatchObject({ category: "Food", thisMonth: 10.3, lastMonth: 5, change: 5.3 });
    expect(rows[1].percent).toBeCloseTo(1.06);
    expect(rows[2]).toEqual({ category: "Bills", thisMonth: 0, lastMonth: 50, change: -50, percent: -1 });
  });
  it("is empty for empty input", () => {
    expect(categoryMonthOverMonth([], now)).toEqual([]);
  });
});

describe("topDescriptions", () => {
  it("groups case- and whitespace-insensitively and keeps the first spelling", () => {
    const rows = topDescriptions(data, 2);
    expect(rows).toEqual([
      { description: "Lunch", count: 2, total: 15.1, average: 7.55 },
      { description: "Power", count: 1, total: 50, average: 50 },
    ]);
  });
  it("respects the limit and ignores blank descriptions", () => {
    const withBlank = [...data, expense({ date: "2026-10-02", amount: 1, category: "Other", description: "   " })];
    expect(topDescriptions(withBlank, 10)).toHaveLength(5);
    expect(topDescriptions(data, 0)).toEqual([]);
    expect(topDescriptions([], 5)).toEqual([]);
  });
});

describe("noSpendStreaks", () => {
  it("finds the current and longest streaks within the window", () => {
    expect(noSpendStreaks(data, 30, now)).toEqual({ current: 2, longest: 20 });
    expect(noSpendStreaks([], 10, now)).toEqual({ current: 10, longest: 10 });
  });
});

describe("generateInsights", () => {
  it("returns nothing for empty input", () => {
    expect(generateInsights([], now)).toEqual([]);
  });
  it("returns between 3 and 6 unique, well-formed insights", () => {
    const insights = generateInsights(data, now);
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.length).toBeLessThanOrEqual(6);
    expect(new Set(insights.map((i) => i.id)).size).toBe(insights.length);
    for (const i of insights) {
      expect(["up", "down", "neutral"]).toContain(i.tone);
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.detail.length).toBeGreaterThan(0);
    }
  });
  it("derives the expected insights from the fixture", () => {
    const byId = Object.fromEntries(generateInsights(data, now).map((i) => [i.id, i]));
    expect(byId["category-up"]).toMatchObject({ tone: "up", title: "Food is up 106% on last month" });
    expect(byId["category-down"]).toMatchObject({ tone: "down", title: "Bills is down 100% on last month" });
    // $50.30 over 28 days = $1.80/day, times 31 days = $55.80, just above last month's $55.
    expect(byId["projection"]).toMatchObject({ tone: "up", title: "On track to spend about $55.80 this month" });
    // $50 on Sep 20 beats $40 on Oct 26 within the 90-day window.
    expect(byId["priciest-day"]).toMatchObject({ tone: "neutral", title: "Sep 20, 2026 was your most expensive day recently" });
    // Sundays: $50 over 13 Sundays (Aug–Oct) beats Mondays' $40.20 over 13 Mondays.
    expect(byId["weekday"].title).toBe("Sundays are your biggest spending day");
    expect(byId["streak"]).toMatchObject({ tone: "down", title: "2 days without spending" });
  });
  it("pads with fallbacks when there is little history", () => {
    // One expense two months ago: no month-over-month change, projection or weekday comparison, so a fallback fills the third slot.
    const single = [expense({ date: "2026-08-28", amount: 12, category: "Food", description: "Coffee" })];
    const insights = generateInsights(single, now);
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.map((i) => i.id)).toEqual(expect.arrayContaining(["priciest-day", "streak", "top-category"]));
    expect(insights.find((i) => i.id === "top-category")).toMatchObject({
      title: "Food makes up 100% of your spending",
      detail: "$12.00 across 1 expense overall.",
    });
  });
});
