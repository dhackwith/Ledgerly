import { describe, expect, it } from "vitest";
import { applyUpdate, mergeMeta, sanitizeMeta, sanitizeSuggestion } from "../expenseMeta";
import { FULL_META, SUGGESTION, expense } from "./metaFixtures";

describe("sanitizeSuggestion", () => {
  it("keeps a well-formed suggestion", () => {
    expect(sanitizeSuggestion(SUGGESTION)).toEqual(SUGGESTION);
  });

  it("accepts the 0 and 1 confidence bounds", () => {
    expect(sanitizeSuggestion({ ...SUGGESTION, confidence: 0 })?.confidence).toBe(0);
    expect(sanitizeSuggestion({ ...SUGGESTION, confidence: 1 })?.confidence).toBe(1);
  });

  it.each([
    ["not an object", "Food"],
    ["null", null],
    ["unknown category", { ...SUGGESTION, category: "Travel" }],
    ["confidence above 1", { ...SUGGESTION, confidence: 1.01 }],
    ["negative confidence", { ...SUGGESTION, confidence: -0.1 }],
    ["NaN confidence", { ...SUGGESTION, confidence: NaN }],
    ["infinite confidence", { ...SUGGESTION, confidence: Infinity }],
    ["string confidence", { ...SUGGESTION, confidence: "0.5" }],
    ["unknown shown", { ...SUGGESTION, shown: "popup" }],
    ["non-boolean accepted", { ...SUGGESTION, accepted: "yes" }],
    ["missing modelVersion", { ...SUGGESTION, modelVersion: undefined }],
    ["numeric modelVersion", { ...SUGGESTION, modelVersion: 3 }],
  ])("rejects %s", (_label, value) => {
    expect(sanitizeSuggestion(value)).toBeUndefined();
  });

  it("drops unknown fields", () => {
    expect(sanitizeSuggestion({ ...SUGGESTION, extra: "<script>" })).toEqual(SUGGESTION);
  });
});

describe("sanitizeMeta", () => {
  it("keeps full meta", () => {
    expect(sanitizeMeta(FULL_META)).toEqual(FULL_META);
  });

  it.each(["manual", "import", "shared-import", "sample"])("accepts source %s", (source) => {
    expect(sanitizeMeta({ source })).toEqual({ source });
  });

  it.each([
    ["undefined", undefined],
    ["a string", "manual"],
    ["an array", ["manual"]],
    ["missing source", { suggestion: SUGGESTION }],
    ["unknown source", { source: "cloud" }],
    ["numeric source", { source: 1 }],
  ])("drops meta that is %s", (_label, value) => {
    expect(sanitizeMeta(value)).toBeUndefined();
  });

  it("drops a malformed suggestion but keeps the source", () => {
    expect(sanitizeMeta({ source: "sample", suggestion: { ...SUGGESTION, confidence: 7 } })).toEqual({ source: "sample" });
  });

  it("drops a malformed recategorizedAt", () => {
    expect(sanitizeMeta({ source: "manual", recategorizedAt: 42 })).toEqual({ source: "manual" });
    expect(sanitizeMeta({ source: "manual", recategorizedAt: "not a date" })).toEqual({ source: "manual" });
  });

  it("drops unknown fields", () => {
    expect(sanitizeMeta({ source: "import", weight: 100 })).toEqual({ source: "import" });
  });
});

describe("mergeMeta", () => {
  it("defaults to source manual", () => {
    expect(mergeMeta(undefined, undefined)).toEqual({ source: "manual" });
  });

  it("keeps the existing source and replaces the suggestion", () => {
    const next = { ...SUGGESTION, category: "Bills" as const, accepted: false };
    expect(mergeMeta({ source: "import", suggestion: SUGGESTION }, { suggestion: next })).toEqual({ source: "import", suggestion: next });
  });

  it("ignores undefined patch values", () => {
    expect(mergeMeta({ source: "sample" }, { source: undefined, suggestion: undefined })).toEqual({ source: "sample" });
  });

  it("sets recategorizedAt when given", () => {
    expect(mergeMeta({ source: "manual" }, undefined, "2026-10-28T00:00:00.000Z")).toEqual({ source: "manual", recategorizedAt: "2026-10-28T00:00:00.000Z" });
  });

  it("does not mutate its inputs", () => {
    const existing = { source: "manual" as const };
    mergeMeta(existing, { source: "import" }, "2026-10-28T00:00:00.000Z");
    expect(existing).toEqual({ source: "manual" });
  });
});

describe("applyUpdate", () => {
  const now = "2026-10-28T09:00:00.000Z";
  const input = { date: "2026-10-04", amount: 20, category: "Food" as const, description: "Dinner" };

  it("sets recategorizedAt when the category changed", () => {
    const updated = applyUpdate(expense({ meta: { source: "import" } }), { ...input, category: "Bills" }, undefined, now);
    expect(updated.meta).toEqual({ source: "import", recategorizedAt: now });
    expect(updated.category).toBe("Bills");
    expect(updated.updatedAt).toBe(now);
  });

  it("leaves recategorizedAt alone when the category is the same", () => {
    const earlier = "2026-10-01T00:00:00.000Z";
    const updated = applyUpdate(expense({ meta: { source: "manual", recategorizedAt: earlier } }), input, undefined, now);
    expect(updated.meta).toEqual({ source: "manual", recategorizedAt: earlier });
  });

  it("gives legacy expenses source manual", () => {
    expect(applyUpdate(expense(), input, undefined, now).meta).toEqual({ source: "manual" });
  });

  it("merges a suggestion patch", () => {
    const updated = applyUpdate(expense({ meta: { source: "shared-import" } }), input, { suggestion: SUGGESTION }, now);
    expect(updated.meta).toEqual({ source: "shared-import", suggestion: SUGGESTION });
    expect(updated.id).toBe("e1");
    expect(updated.createdAt).toBe("2026-10-03T12:00:00.000Z");
  });
});
