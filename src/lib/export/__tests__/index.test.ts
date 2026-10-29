import { describe, expect, it } from "vitest";
import { buildExport, exportFilename } from "@/lib/export";
import { FIXED_NOW, SAMPLE } from "./fixtures";

describe("exportFilename", () => {
  it("uses the local calendar date and the format as the extension", () => {
    expect(exportFilename("csv", FIXED_NOW)).toBe("expenses-2026-10-28.csv");
    expect(exportFilename("json", FIXED_NOW)).toBe("expenses-2026-10-28.json");
    expect(exportFilename("pdf", FIXED_NOW)).toBe("expenses-2026-10-28.pdf");
  });
  it("zero-pads single-digit months and days", () => {
    expect(exportFilename("csv", new Date(2026, 0, 5))).toBe("expenses-2026-01-05.csv");
  });
});

describe("buildExport", () => {
  it("returns text with the CSV MIME type for csv", () => {
    const r = buildExport(SAMPLE, { format: "csv", scope: "all", includeSummary: false }, FIXED_NOW);
    expect(r.mimeType).toBe("text/csv;charset=utf-8");
    expect(r.filename).toBe("expenses-2026-10-28.csv");
    expect(typeof r.content).toBe("string");
    expect((r.content as string).charCodeAt(0)).toBe(0xfeff);
  });
  it("returns parseable JSON for json", () => {
    const r = buildExport(SAMPLE, { format: "json", scope: "filtered", includeSummary: true }, FIXED_NOW);
    expect(r.mimeType).toBe("application/json;charset=utf-8");
    expect(JSON.parse(r.content as string)).toMatchObject({ scope: "filtered", count: 3, total: 60.3 });
  });
  it("returns bytes for pdf", () => {
    const r = buildExport(SAMPLE, { format: "pdf", scope: "all", includeSummary: true }, FIXED_NOW);
    expect(r.mimeType).toBe("application/pdf");
    expect(r.content).toBeInstanceOf(Uint8Array);
    expect(Array.from((r.content as Uint8Array).slice(0, 5), (b) => String.fromCharCode(b)).join("")).toBe("%PDF-");
  });
});
