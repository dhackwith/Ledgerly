import { describe, expect, it } from "vitest";
import { periodRange, topVendors, vendorKey, vendorName, vendorTotals, UNSPECIFIED_VENDOR, VENDOR_PERIODS } from "@/lib/topVendors";
import type { Expense } from "@/lib/types";

let seq = 0;
function expense(partial: Partial<Expense> & Pick<Expense, "date" | "amount">): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    category: "Food",
    description: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

// Wednesday 28 October 2026.
const now = new Date(2026, 9, 28);

describe("vendorName / vendorKey", () => {
  it("trims, collapses whitespace and preserves case in the name", () => {
    expect(vendorName("  Corner   Store ")).toBe("Corner Store");
    expect(vendorKey("  Corner   Store ")).toBe("corner store");
    expect(vendorKey("CORNER\tstore")).toBe("corner store");
  });

  it("strips a trailing hash reference of any length", () => {
    expect(vendorName("Starbucks #1234")).toBe("Starbucks");
    expect(vendorName("Starbucks #12")).toBe("Starbucks");
    expect(vendorName("Starbucks#7")).toBe("Starbucks");
    expect(vendorName("Starbucks # 0042")).toBe("Starbucks");
  });

  it("strips a trailing bare number of 3+ digits but keeps short ones", () => {
    expect(vendorName("Shell 04512")).toBe("Shell");
    expect(vendorName("Route 66")).toBe("Route 66");
    expect(vendorName("7-Eleven")).toBe("7-Eleven");
  });

  it("removes separators left behind by the reference and trailing punctuation", () => {
    expect(vendorName("Starbucks - #1234")).toBe("Starbucks");
    expect(vendorName("Starbucks.")).toBe("Starbucks");
  });

  it("only strips one reference and only at the end", () => {
    expect(vendorName("Store 12 #345")).toBe("Store 12");
    expect(vendorName("#1 Pizza")).toBe("#1 Pizza");
  });

  it("keeps the description when stripping would leave nothing", () => {
    expect(vendorName("#1234")).toBe("#1234");
    expect(vendorName("1234")).toBe("1234");
  });

  it("returns an empty key for empty or whitespace-only descriptions", () => {
    expect(vendorKey("")).toBe("");
    expect(vendorKey("   \n ")).toBe("");
  });
});

describe("periodRange", () => {
  it("covers the current month, the last 3 calendar months, the year and all time", () => {
    expect(periodRange("month", now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("quarter", now)).toEqual({ from: "2026-08-01", to: "2026-10-31" });
    expect(periodRange("year", now)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange("all", now)).toEqual({ from: null, to: null });
  });

  it("crosses year boundaries for the 3-month window", () => {
    expect(periodRange("quarter", new Date(2026, 0, 15))).toEqual({ from: "2025-11-01", to: "2026-01-31" });
    expect(periodRange("month", new Date(2024, 1, 10))).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("has a label for every period option", () => {
    expect(VENDOR_PERIODS.map((p) => p.value)).toEqual(["month", "quarter", "year", "all"]);
  });
});

describe("vendorTotals", () => {
  it("returns an empty summary for no expenses", () => {
    expect(vendorTotals([])).toEqual({ total: 0, count: 0, vendors: [] });
  });

  it("groups by normalised vendor and ranks by total, highest first", () => {
    const { total, count, vendors } = vendorTotals([
      expense({ date: "2026-10-01", amount: 4.1, description: "Starbucks #1234" }),
      expense({ date: "2026-10-02", amount: 5.2, description: "starbucks" }),
      expense({ date: "2026-10-03", amount: 0.7, description: "  STARBUCKS  #99 " }),
      expense({ date: "2026-10-04", amount: 20, description: "Shell 04512", category: "Transportation" }),
    ]);
    expect(total).toBe(30);
    expect(count).toBe(4);
    expect(vendors.map((v) => [v.key, v.total, v.count])).toEqual([
      ["shell", 20, 1],
      ["starbucks", 10, 3],
    ]);
    expect(vendors[0].share).toBeCloseTo(2 / 3);
    expect(vendors[1].share).toBeCloseTo(1 / 3);
  });

  it("uses the most frequent spelling as the display name", () => {
    const { vendors } = vendorTotals([
      expense({ date: "2026-10-01", amount: 1, description: "TRADER JOES" }),
      expense({ date: "2026-10-02", amount: 1, description: "Trader Joes #552" }),
      expense({ date: "2026-10-03", amount: 1, description: "trader   joes" }),
      expense({ date: "2026-10-04", amount: 1, description: "Trader Joes" }),
    ]);
    expect(vendors).toHaveLength(1);
    expect(vendors[0].name).toBe("Trader Joes");
  });

  it("breaks display-name ties by the most recent use, then code-unit order", () => {
    const byDate = vendorTotals([
      expense({ date: "2026-10-05", amount: 1, description: "acme" }),
      expense({ date: "2026-10-01", amount: 1, description: "ACME" }),
    ]);
    expect(byDate.vendors[0].name).toBe("acme");
    const sameDay = [
      expense({ date: "2026-10-01", amount: 1, description: "acme" }),
      expense({ date: "2026-10-01", amount: 1, description: "Acme" }),
    ];
    expect(vendorTotals(sameDay).vendors[0].name).toBe("Acme");
    expect(vendorTotals([...sameDay].reverse()).vendors[0].name).toBe("Acme");
  });

  it("breaks ranking ties by count, then by key, independent of input order", () => {
    const items = [
      expense({ date: "2026-10-01", amount: 10, description: "Zeta" }),
      expense({ date: "2026-10-01", amount: 10, description: "Alpha" }),
      expense({ date: "2026-10-01", amount: 5, description: "Beta" }),
      expense({ date: "2026-10-02", amount: 5, description: "Beta" }),
    ];
    const expected = ["beta", "alpha", "zeta"];
    expect(vendorTotals(items).vendors.map((v) => v.key)).toEqual(expected);
    expect(vendorTotals([...items].reverse()).vendors.map((v) => v.key)).toEqual(expected);
  });

  it("picks the most common category, tie-breaking on spend then category order", () => {
    const { vendors } = vendorTotals([
      expense({ date: "2026-10-01", amount: 5, description: "Target", category: "Shopping" }),
      expense({ date: "2026-10-02", amount: 5, description: "Target", category: "Shopping" }),
      expense({ date: "2026-10-03", amount: 50, description: "Target", category: "Food" }),
      expense({ date: "2026-10-01", amount: 5, description: "Costco", category: "Food" }),
      expense({ date: "2026-10-02", amount: 9, description: "Costco", category: "Other" }),
      expense({ date: "2026-10-01", amount: 3, description: "Kiosk", category: "Other" }),
      expense({ date: "2026-10-02", amount: 3, description: "Kiosk", category: "Bills" }),
    ]);
    const top = Object.fromEntries(vendors.map((v) => [v.key, v.topCategory]));
    expect(top).toEqual({ target: "Shopping", costco: "Other", kiosk: "Bills" });
  });

  it("filters to an inclusive date range", () => {
    const items = [
      expense({ date: "2026-07-31", amount: 1, description: "Before" }),
      expense({ date: "2026-08-01", amount: 2, description: "First day" }),
      expense({ date: "2026-10-31", amount: 3, description: "Last day" }),
      expense({ date: "2026-11-01", amount: 4, description: "After" }),
    ];
    const { total, vendors } = vendorTotals(items, periodRange("quarter", now));
    expect(total).toBe(5);
    expect(vendors.map((v) => v.name)).toEqual(["Last day", "First day"]);
    expect(vendorTotals(items, periodRange("all", now)).total).toBe(10);
  });

  it("groups empty descriptions into an Unspecified bucket ranked with the rest", () => {
    const { vendors, total } = vendorTotals([
      expense({ date: "2026-10-01", amount: 30, description: "" }),
      expense({ date: "2026-10-02", amount: 10, description: "   " }),
      expense({ date: "2026-10-03", amount: 20, description: "Deli" }),
    ]);
    expect(total).toBe(60);
    expect(vendors[0]).toMatchObject({ key: "", name: UNSPECIFIED_VENDOR, unspecified: true, total: 40, count: 2 });
    expect(vendors[1]).toMatchObject({ key: "deli", unspecified: false });
  });

  it("ignores non-finite, zero, negative and non-number amounts", () => {
    const { total, count, vendors } = vendorTotals([
      expense({ date: "2026-10-01", amount: Number.NaN, description: "Bad" }),
      expense({ date: "2026-10-01", amount: Number.POSITIVE_INFINITY, description: "Bad" }),
      expense({ date: "2026-10-01", amount: 0, description: "Bad" }),
      expense({ date: "2026-10-01", amount: -5, description: "Bad" }),
      expense({ date: "2026-10-01", amount: "7" as unknown as number, description: "Bad" }),
      expense({ date: "2026-10-01", amount: 2.5, description: "Good" }),
    ]);
    expect(total).toBe(2.5);
    expect(count).toBe(1);
    expect(vendors.map((v) => v.key)).toEqual(["good"]);
    expect(vendors[0].share).toBe(1);
  });

  it("sums in whole cents", () => {
    const { vendors, total } = vendorTotals([
      expense({ date: "2026-10-01", amount: 0.1, description: "Gum" }),
      expense({ date: "2026-10-02", amount: 0.2, description: "Gum" }),
    ]);
    expect(vendors[0].total).toBe(0.3);
    expect(total).toBe(0.3);
  });
});

describe("topVendors", () => {
  const { vendors } = vendorTotals(
    Array.from({ length: 12 }, (_, i) => expense({ date: "2026-10-01", amount: i + 1, description: `Vendor ${String.fromCharCode(65 + i)}` })),
  );

  it("cuts the ranked list off at the limit", () => {
    const top = topVendors(vendors, 10);
    expect(top).toHaveLength(10);
    expect(top[0].name).toBe("Vendor L");
    expect(top[9].name).toBe("Vendor C");
  });

  it("returns everything when the limit exceeds the list and nothing for a non-positive limit", () => {
    expect(topVendors(vendors, 50)).toHaveLength(12);
    expect(topVendors(vendors, 0)).toEqual([]);
    expect(topVendors(vendors, -3)).toEqual([]);
    expect(topVendors(vendors, 2.9)).toHaveLength(2);
  });
});
