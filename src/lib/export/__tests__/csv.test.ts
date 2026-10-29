import { describe, expect, it } from "vitest";
import { buildCSV, CSV_BOM, escapeCell, expensesToCSV, summaryToCSV } from "@/lib/export/csv";
import { expense, SAMPLE } from "./fixtures";

describe("escapeCell", () => {
  it("prefixes cells that a spreadsheet would run as a formula", () => {
    expect(escapeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCell("+1")).toBe("'+1");
    expect(escapeCell("-1")).toBe("'-1");
    expect(escapeCell("@cmd")).toBe("'@cmd");
    expect(escapeCell("\tx")).toBe("'\tx");
  });
  it("quotes cells containing commas, quotes or newlines and doubles embedded quotes", () => {
    expect(escapeCell('Say "hi", please')).toBe('"Say ""hi"", please"');
    expect(escapeCell("two\nlines")).toBe('"two\nlines"');
  });
  it("leaves plain cells alone", () => {
    expect(escapeCell("Coffee")).toBe("Coffee");
  });
});

describe("expensesToCSV", () => {
  it("writes a header, one row per expense, two-decimal amounts and CRLF line endings", () => {
    const csv = expensesToCSV(SAMPLE);
    expect(csv.split("\r\n")).toEqual([
      "Date,Category,Description,Amount",
      "2026-10-01,Food,Lunch,10.10",
      "2026-10-05,Food,Gum,0.20",
      "2026-09-20,Bills,Power,50.00",
    ]);
    expect(csv).not.toMatch(/[^\r]\n/);
  });
  it("escapes descriptions", () => {
    const rows = expensesToCSV([expense({ date: "2026-10-01", amount: 1, category: "Other", description: "=HYPERLINK(1)" })]);
    expect(rows.split("\r\n")[1]).toBe("2026-10-01,Other,'=HYPERLINK(1),1.00");
  });
  it("honours a column selection in canonical order", () => {
    expect(expensesToCSV(SAMPLE, ["amount", "date"]).split("\r\n")[0]).toBe("Date,Amount");
  });
});

describe("summaryToCSV", () => {
  it("lists category totals with a grand total row", () => {
    expect(summaryToCSV(SAMPLE).split("\r\n")).toEqual([
      "Category,Expenses,Total,Share",
      "Bills,1,50.00,83%",
      "Food,2,10.30,17%",
      "Total,3,60.30,100%",
    ]);
  });
});

describe("buildCSV", () => {
  it("starts with the UTF-8 byte-order mark", () => {
    const out = buildCSV(SAMPLE, { includeSummary: false });
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1)).toBe(expensesToCSV(SAMPLE));
  });
  it("appends the summary after a blank line when asked", () => {
    const out = buildCSV(SAMPLE, { includeSummary: true }).slice(CSV_BOM.length);
    expect(out).toBe(`${expensesToCSV(SAMPLE)}\r\n\r\n${summaryToCSV(SAMPLE)}`);
  });
});
