import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/types";
import { expensesToCSV } from "@/lib/csv";
import { FULL_META, SUGGESTION, expense } from "@/lib/__tests__/metaFixtures";
import { serialize, toCsv, toDigest, toJson, toTsv, totalsOnly, type Report } from "../report";
import { decodeShare, encodeShare } from "../share";
import { TEMPLATE_ORDER, buildReport } from "../templates";

// Meta (provenance and suggestion details) must never leave the device.
const FORBIDDEN = ["meta", "suggestion", "confidence", "recategorizedat", "modelversion", '"source"', "test-model-1"];

function expectNoMeta(text: string) {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) expect(lower, `output contains ${word}`).not.toContain(word);
}

const NOW = new Date(2026, 9, 15, 12);

// Dates cover every template's default period for NOW: this month, last month, this tax year, and older.
const EXPENSES: Expense[] = [
  expense({ id: "a", date: "2026-10-03", category: "Food", description: "Lunch", meta: FULL_META }),
  expense({ id: "b", date: "2026-10-09", category: "Bills", description: "Phone bill", meta: { source: "import", suggestion: { ...SUGGESTION, category: "Bills" } } }),
  expense({ id: "c", date: "2026-09-12", category: "Transportation", description: "Train", meta: { source: "shared-import", recategorizedAt: "2026-09-13T00:00:00.000Z" } }),
  expense({ id: "d", date: "2026-03-01", category: "Shopping", description: "Shoes", meta: { source: "sample", suggestion: SUGGESTION } }),
  expense({ id: "e", date: "2025-12-20", category: "Entertainment", description: "Concert", meta: FULL_META }),
];

function reports(): [string, Report][] {
  return TEMPLATE_ORDER.flatMap((id) => {
    const full = buildReport(id, EXPENSES, {}, NOW);
    return [
      [`${id} (full)`, full],
      [`${id} (totals only)`, totalsOnly(full)],
    ] as [string, Report][];
  });
}

describe("export privacy boundary", () => {
  it("builds non-empty reports from the fixture", () => {
    for (const id of TEMPLATE_ORDER) {
      const report = buildReport(id, EXPENSES, {}, NOW);
      expect(report.recordCount, id).toBeGreaterThan(0);
      expect(report.expenses?.length, id).toBeGreaterThan(0);
    }
  });

  it.each(reports())("keeps meta out of every format for %s", (_label, report) => {
    expectNoMeta(JSON.stringify(report));
    expectNoMeta(toJson(report));
    expectNoMeta(toCsv(report));
    expectNoMeta(toTsv(report)); // Copy as table, Google Sheets
    expectNoMeta(toDigest(report)); // Email body, Slack
    expectNoMeta(serialize(report, "json").text); // Download, Drive, Dropbox, OneDrive, email attachment
    expectNoMeta(serialize(report, "csv").text);
  });

  it("gives report expenses only the portable fields", () => {
    for (const id of TEMPLATE_ORDER) {
      for (const e of buildReport(id, EXPENSES, {}, NOW).expenses ?? []) {
        expect(Object.keys(e).sort()).toEqual(["amount", "category", "date", "description"]);
      }
    }
  });

  it("keeps meta out of the Full Backup JSON, which still has every expense", () => {
    const text = serialize(buildReport("full-backup", EXPENSES, {}, NOW), "json").text;
    expectNoMeta(text);
    const parsed = JSON.parse(text) as { expenses: unknown[] };
    expect(parsed.expenses).toHaveLength(EXPENSES.length);
  });

  it("keeps meta out of the expenses CSV export", () => {
    const csv = expensesToCSV(EXPENSES);
    expectNoMeta(csv);
    expect(csv.split("\r\n")).toHaveLength(EXPENSES.length + 1);
  });

  it.each([
    ["plain", undefined],
    ["encrypted", "correct horse battery"],
  ])("keeps meta out of %s share links", async (_label, password) => {
    for (const [, report] of reports()) {
      const payload = { v: 1 as const, report, sharedAt: NOW.toISOString(), from: "Sam", message: "Here you go" };
      const token = await encodeShare(payload, password);
      const decoded = await decodeShare(token, password);
      expect(decoded.kind).toBe("ok");
      if (decoded.kind === "ok") expectNoMeta(JSON.stringify(decoded.payload));
    }
  }, 60_000);
});
