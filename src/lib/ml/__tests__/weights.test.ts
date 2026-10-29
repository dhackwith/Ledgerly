import { describe, expect, it } from "vitest";
import type { Category, Expense, ExpenseMeta } from "@/lib/types";
import { DEFAULT_PARAMS } from "../calibration";
import { createSuggester } from "../index";
import { buildModel } from "../suggester";
import { baseWeight, exampleWeight, labelTime, recencyFactor } from "../weights";

const W = DEFAULT_PARAMS.weights;
const DAY = 86_400_000;
const NOW = new Date("2026-06-01T12:00:00Z");

let seq = 0;
function exp(description: string, category: Category, meta?: ExpenseMeta, date = "2026-05-01", createdAt = "2026-05-01T12:00:00.000Z"): Expense {
  seq++;
  return { id: `e${seq}`, date, amount: 12, category, description, createdAt, updatedAt: createdAt, meta };
}
const preselected = (accepted: boolean): ExpenseMeta => ({
  source: "manual",
  suggestion: { category: "Food", confidence: 0.9, shown: "preselected", accepted, modelVersion: "1" },
});

describe("example weights", () => {
  it("excludes sample data and unknown categories", () => {
    expect(baseWeight(exp("x", "Food", { source: "sample" }), W, null)).toBe(0);
    expect(baseWeight(exp("x", "Groceries" as Category), W, null)).toBe(0);
  });

  it("weights sources: manual and import 1, shared-import 0.3, missing meta as manual", () => {
    expect(baseWeight(exp("x", "Food"), W, null)).toBe(1);
    expect(baseWeight(exp("x", "Food", { source: "manual" }), W, null)).toBe(1);
    expect(baseWeight(exp("x", "Food", { source: "import" }), W, null)).toBe(1);
    expect(baseWeight(exp("x", "Food", { source: "shared-import" }), W, null)).toBe(0.3);
  });

  it("boosts recategorized expenses to 2, whatever the source", () => {
    expect(baseWeight(exp("x", "Food", { source: "manual", recategorizedAt: "2026-05-02T00:00:00Z" }), W, null)).toBe(2);
    expect(baseWeight(exp("x", "Food", { source: "shared-import", recategorizedAt: "2026-05-02T00:00:00Z" }), W, null)).toBe(2);
  });

  it("damps accepted pre-selected suggestions to 0.7 and nothing else", () => {
    expect(baseWeight(exp("x", "Food", preselected(true)), W, null)).toBeCloseTo(0.7, 12);
    expect(baseWeight(exp("x", "Food", preselected(false)), W, null)).toBe(1);
    const chips: ExpenseMeta = { source: "manual", suggestion: { category: "Food", confidence: 0.6, shown: "chips", accepted: true, modelVersion: "1" } };
    expect(baseWeight(exp("x", "Food", chips), W, null)).toBe(1);
    const shared: ExpenseMeta = { ...preselected(true), source: "shared-import" };
    expect(baseWeight(exp("x", "Food", shared), W, null)).toBeCloseTo(0.21, 12);
  });

  it("ignores suggestion metadata saved before the reset cut-off", () => {
    const e = exp("x", "Food", preselected(true), "2026-05-01", "2026-05-01T12:00:00.000Z");
    expect(baseWeight(e, W, Date.parse("2026-05-02T00:00:00Z"))).toBe(1);
    expect(baseWeight(e, W, Date.parse("2026-05-01T12:00:00Z"))).toBeCloseTo(0.7, 12);
    expect(baseWeight(e, W, Date.parse("2026-04-01T00:00:00Z"))).toBeCloseTo(0.7, 12);
  });

  it("halves weight every 180 days and treats future labels as new", () => {
    expect(recencyFactor(0, 180)).toBe(1);
    expect(recencyFactor(180 * DAY, 180)).toBeCloseTo(0.5, 12);
    expect(recencyFactor(360 * DAY, 180)).toBeCloseTo(0.25, 12);
    expect(recencyFactor(-30 * DAY, 180)).toBe(1);
    const old = exp("x", "Food", undefined, "2025-12-03");
    expect(exampleWeight(old, W, Date.parse("2026-06-01T12:00:00Z"), null)).toBeCloseTo(0.5, 6);
  });

  it("dates a label by its recategorization, else by the expense date", () => {
    expect(labelTime(exp("x", "Food", undefined, "2026-05-01"))).toBe(Date.parse("2026-05-01T12:00:00Z"));
    expect(labelTime(exp("x", "Food", { source: "manual", recategorizedAt: "2026-05-20T08:00:00Z" }))).toBe(Date.parse("2026-05-20T08:00:00Z"));
  });
});

describe("weights inside the suggester", () => {
  const query = { description: "golden dragon", amount: 12, date: "2026-05-30", mode: "create" as const };
  const pEnt = (expenses: Expense[], options = {}) => {
    const ex = buildModel(expenses, { now: NOW, ...options }).explain(query);
    return ex.probs[2]; // Entertainment
  };
  const three = (meta?: ExpenseMeta) => [1, 2, 3].map(() => exp("Golden Dragon", "Entertainment", meta));

  it("treats sample-only history exactly like no history", () => {
    const sample = createSuggester(three({ source: "sample" }), { now: NOW });
    const empty = createSuggester([], { now: NOW });
    for (const description of ["golden dragon", "uber", "rent", "amazon"]) {
      expect(sample.suggest({ ...query, description })).toEqual(empty.suggest({ ...query, description }));
    }
  });

  it("learns less from someone else's habits than from the user's own", () => {
    expect(pEnt(three({ source: "shared-import" }))).toBeLessThan(pEnt(three({ source: "manual" })));
    expect(pEnt(three({ source: "shared-import" }))).toBeGreaterThan(pEnt([]));
  });

  it("learns more from a recategorization than from a plain save", () => {
    const plain = [exp("Golden Dragon", "Entertainment")];
    const recat = [exp("Golden Dragon", "Entertainment", { source: "manual", recategorizedAt: "2026-05-01T12:00:00Z" })];
    expect(pEnt(recat)).toBeGreaterThan(pEnt(plain));
  });

  it("damps accepted pre-selections until learning is reset", () => {
    const accepted = three(preselected(true));
    const damped = pEnt(accepted);
    const reset = pEnt(accepted, { ignoreSuggestionMetaBefore: "2026-05-15T00:00:00Z" });
    expect(damped).toBeLessThan(pEnt(three()));
    expect(reset).toBeCloseTo(pEnt(three()), 12);
  });

  it("lets old labels fade", () => {
    const old = [1, 2, 3].map(() => exp("Golden Dragon", "Entertainment", undefined, "2026-01-05", "2026-01-05T12:00:00.000Z"));
    const fresh = buildModel(old, { now: new Date("2026-01-20T00:00:00Z") }).explain(query).probs[2];
    const stale = buildModel(old, { now: new Date("2029-01-20T00:00:00Z") }).explain(query).probs[2];
    expect(stale).toBeLessThan(fresh);
  });
});
