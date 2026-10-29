import { describe, expect, it } from "vitest";
import { buildPDF, PDF_TITLE } from "@/lib/export/pdf";
import { measureText, toWinAnsi } from "@/lib/export/pdf-writer";
import { expense, FIXED_NOW, manyExpenses, SAMPLE } from "./fixtures";

/** The PDF is pure single-byte output, so latin1 gives back the exact serialized text. */
function decode(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function pageCount(text: string): number {
  const declared = Number(/\/Count (\d+)/.exec(text)?.[1]);
  const actual = (text.match(/\/Type \/Page /g) ?? []).length;
  expect(actual).toBe(declared);
  return declared;
}

function rowCount(text: string): number {
  return (text.match(/\(Expense #\d+\) Tj/g) ?? []).length;
}

describe("buildPDF", () => {
  it("produces a PDF with a header, trailer and the report title", () => {
    const text = decode(buildPDF(SAMPLE, { includeSummary: true }, FIXED_NOW));
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain(`(${PDF_TITLE}) Tj`);
    expect(text).toContain("(Generated Oct 28, 2026, 2:30 PM) Tj");
    expect(text).toContain("/Title (Ledgerly expense export)");
    expect(text).toContain("(Summary by category) Tj");
    expect(text).toContain("($60.30) Tj");
  });

  it("writes every expense as a row and fits a short list on one page", () => {
    const text = decode(buildPDF(manyExpenses(10), { includeSummary: true }, FIXED_NOW));
    expect(rowCount(text)).toBe(10);
    expect(pageCount(text)).toBe(1);
    expect(text).toContain("(Page 1 of 1) Tj");
  });

  it("breaks long lists across pages, repeating the table header and numbering the pages", () => {
    const text = decode(buildPDF(manyExpenses(100), { includeSummary: false }, FIXED_NOW));
    expect(rowCount(text)).toBe(100);
    expect(pageCount(text)).toBe(4);
    expect((text.match(/\(DESCRIPTION\) Tj/g) ?? []).length).toBe(4);
    expect(text).toContain("(Page 1 of 4) Tj");
    expect(text).toContain("(Page 4 of 4) Tj");
    expect((text.match(/\(Ledgerly expense export \\\(continued\\\)\) Tj/g) ?? []).length).toBe(3);
  });

  it("keeps the grand total on the same page as the last row", () => {
    // 27 rows would fill page one exactly; the last row must move with the total.
    const text = decode(buildPDF(manyExpenses(27), { includeSummary: false }, FIXED_NOW));
    expect(pageCount(text)).toBe(2);
    const lastPage = text.slice(text.lastIndexOf("\nstream\n"));
    expect(lastPage).toContain("(Expense #27) Tj");
    expect(lastPage).toContain("(Total) Tj");
  });

  it("omits the summary when not asked and still renders with no expenses", () => {
    const text = decode(buildPDF([], { includeSummary: false }, FIXED_NOW));
    expect(text).not.toContain("(Summary by category) Tj");
    expect(text).toContain("(No expenses to export.) Tj");
    expect(pageCount(text)).toBe(1);
  });

  it("escapes parentheses and backslashes in text and drops only the selected columns", () => {
    const tricky = expense({ date: "2026-10-01", amount: 1, category: "Other", description: "Dinner (with \\ friends)" });
    const text = decode(buildPDF([tricky], { includeSummary: false, columns: ["description", "amount"] }, FIXED_NOW));
    expect(text).toContain("(Dinner \\(with \\\\ friends\\)) Tj");
    expect(text).not.toContain("(DATE) Tj");
    expect(text).toContain("(AMOUNT) Tj");
  });
});

describe("text encoding", () => {
  it("maps curly quotes and dashes to WinAnsi, drops emoji and replaces unsupported characters", () => {
    expect(toWinAnsi("it’s – fine")).toBe(`it${String.fromCharCode(0x92)}s ${String.fromCharCode(0x96)} fine`);
    expect(toWinAnsi("Coffee ☕️ time")).toBe("Coffee time");
    expect(toWinAnsi("寿司")).toBe("??");
  });
  it("measures bold text wider than regular text", () => {
    expect(measureText("Total", 10, "bold")).toBeGreaterThan(measureText("Total", 10));
    expect(measureText("", 10)).toBe(0);
  });
});
