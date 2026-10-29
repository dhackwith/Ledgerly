import { describe, expect, it } from "vitest";
import { buildJSON, buildJSONDocument } from "@/lib/export/json";
import { FIXED_NOW, SAMPLE } from "./fixtures";

describe("buildJSONDocument", () => {
  it("has the documented shape with amounts as numbers and the total summed in cents", () => {
    const doc = buildJSONDocument(SAMPLE, { scope: "all", includeSummary: false }, FIXED_NOW);
    expect(Object.keys(doc)).toEqual(["exportedAt", "scope", "count", "total", "expenses"]);
    expect(doc.exportedAt).toBe(FIXED_NOW.toISOString());
    expect(doc.scope).toBe("all");
    expect(doc.count).toBe(3);
    expect(doc.total).toBe(60.3);
    expect(doc.expenses[0]).toEqual({ id: "a", date: "2026-10-01", category: "Food", description: "Lunch", amount: 10.1 });
    expect(typeof doc.expenses[2].amount).toBe("number");
  });

  it("adds a category summary between the totals and the expenses when asked", () => {
    const doc = buildJSONDocument(SAMPLE, { scope: "filtered", includeSummary: true }, FIXED_NOW);
    expect(Object.keys(doc)).toEqual(["exportedAt", "scope", "count", "total", "summary", "expenses"]);
    expect(doc.summary?.byCategory).toEqual([
      { category: "Bills", count: 1, total: 50, share: 0.8292 },
      { category: "Food", count: 2, total: 10.3, share: 0.1708 },
    ]);
  });

  it("limits expense fields to the selected columns, keeping the id", () => {
    const doc = buildJSONDocument(SAMPLE, { scope: "all", includeSummary: false, columns: ["date", "amount"] });
    expect(doc.expenses[0]).toEqual({ id: "a", date: "2026-10-01", amount: 10.1 });
  });

  it("handles an empty list", () => {
    const doc = buildJSONDocument([], { scope: "all", includeSummary: true });
    expect(doc).toMatchObject({ count: 0, total: 0, summary: { byCategory: [] }, expenses: [] });
  });
});

describe("buildJSON", () => {
  it("pretty-prints with two-space indentation and parses back to the same document", () => {
    const text = buildJSON(SAMPLE, { scope: "all", includeSummary: true }, FIXED_NOW);
    expect(text.startsWith('{\n  "exportedAt": ')).toBe(true);
    expect(text.endsWith("}\n")).toBe(true);
    expect(JSON.parse(text)).toEqual(buildJSONDocument(SAMPLE, { scope: "all", includeSummary: true }, FIXED_NOW));
  });
});
