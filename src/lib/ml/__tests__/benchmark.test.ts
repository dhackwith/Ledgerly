import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORIES, type Category } from "@/lib/types";
import { generateUser, mulberry32, type SyntheticUser } from "../benchmark/generator";
import { expectedCalibrationError, replayUser, summarize, type ReplayMetrics, type ReplayRecord } from "../benchmark/replay";
import { matchLexicon } from "../lexicon";
import { normalizeDescription, tokenize } from "../normalize";
import { createSuggester } from "../index";

/** Fixed seeds: the CI accuracy gate of plan 3.5 / 7.3. */
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

let users: SyntheticUser[];
let records: ReplayRecord[][];
let metrics: ReplayMetrics;

beforeAll(() => {
  users = SEEDS.map((s) => generateUser(s));
  records = users.map((u) => replayUser(u));
  metrics = summarize(records);
  // Printed so CI logs show the baseline next to the gates.
  console.info("ML benchmark", JSON.stringify(metrics));
}, 120_000);

describe("synthetic benchmark generator", () => {
  it("is deterministic", () => {
    expect(generateUser(3)).toEqual(generateUser(3));
    expect(generateUser(3)).not.toEqual(generateUser(4));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces realistic, varied users", () => {
    for (const u of users) {
      expect(u.items.length).toBeGreaterThan(200);
      const cats = new Set(u.items.map((i) => i.expense.category));
      expect(cats.size).toBe(CATEGORIES.length);
      // Class imbalance: Food is the largest class by a wide margin.
      const share = (c: string) => u.items.filter((i) => i.expense.category === c).length / u.items.length;
      expect(share("Food")).toBeGreaterThan(0.2);
      for (const c of CATEGORIES) if (c !== "Food") expect(share("Food")).toBeGreaterThan(share(c));
      // Ordered by createdAt, like the replay expects.
      const created = u.items.map((i) => i.expense.createdAt);
      expect([...created].sort()).toEqual(created);
    }
    expect(new Set(users.map((u) => u.style)).size).toBe(3);
    expect(users.filter((u) => u.drift).length).toBeGreaterThanOrEqual(2);
    expect(users.filter((u) => Object.keys(u.relabels).length).length).toBeGreaterThanOrEqual(2);
  });

  it("is not just the lexicon in disguise", () => {
    const all = users.flatMap((u) => u.items.map((i) => i.expense.description));
    const covered = all.filter((d) => matchLexicon(tokenize(normalizeDescription(d))).length > 0).length / all.length;
    expect(covered).toBeGreaterThan(0.5);
    expect(covered).toBeLessThan(0.85);
  });
});

describe("prequential replay gates (plan 3.5)", () => {
  it("is >= 60% top-1 over each user's first 10 expenses", () => {
    expect(metrics.earlyTop1).toBeGreaterThanOrEqual(0.6);
  });

  it("is >= 85% top-1 and >= 97% top-3 after 50 expenses", () => {
    expect(metrics.warmTop1).toBeGreaterThanOrEqual(0.85);
    expect(metrics.warmTop3).toBeGreaterThanOrEqual(0.97);
  });

  it("pre-selects the right category >= 95% of the time", () => {
    expect(metrics.preselected).toBeGreaterThan(100);
    expect(metrics.preselectPrecision).toBeGreaterThanOrEqual(0.95);
  });

  it("is calibrated: expected calibration error < 0.05", () => {
    expect(metrics.ece).toBeLessThan(0.05);
  });

  it("recalls every class, not just the dominant one (plan 6.2)", () => {
    for (const c of CATEGORIES) expect(metrics.perClassRecall[c]).toBeGreaterThanOrEqual(0.75);
  });

  it("picks up habit drift within a few labels", () => {
    expect(metrics.driftLag).not.toBeNull();
    expect(metrics.driftLag as number).toBeLessThanOrEqual(3);
    expect(metrics.driftSettledTop1 as number).toBeGreaterThanOrEqual(0.8);
  });

  it("learns each user's personal relabels", () => {
    const relabeled = records.flatMap((rs, i) => rs.filter((r) => r.index >= 50 && users[i].relabels[r.merchant] !== undefined));
    expect(relabeled.length).toBeGreaterThan(20);
    const right = relabeled.filter((r) => r.order[0] === r.truth).length / relabeled.length;
    expect(right).toBeGreaterThanOrEqual(0.85);
  });
});

describe("personalization across synthetic users", () => {
  it("gives two users who file the same merchant differently their own answers", () => {
    const base = generateUser(7);
    const merchants = ["Starbucks", "Shell", "Target"].filter((m) => base.items.some((i) => i.merchant === m));
    const counts = new Map<string, number>();
    for (const i of base.items) counts.set(i.merchant, (counts.get(i.merchant) ?? 0) + 1);
    const frequent = Array.from(counts.entries()).filter(([m, n]) => n >= 5 && !m.startsWith("tail:") && m !== "one-off").map(([m]) => m);
    const picked = Array.from(new Set([...merchants, ...frequent])).slice(0, 4);
    expect(picked.length).toBeGreaterThanOrEqual(2);
    for (const merchant of picked) {
      const items = base.items.filter((i) => i.merchant === merchant);
      const original = items[items.length - 1].expense.category;
      const other: Category = original === "Entertainment" ? "Other" : "Entertainment";
      const a = base.items.map((i) => i.expense);
      const b = a.map((e, k) => (base.items[k].merchant === merchant ? { ...e, category: other } : e));
      const last = items[items.length - 1].expense;
      const query = { description: last.description, amount: last.amount, date: last.date, mode: "create" as const };
      const now = new Date(last.createdAt);
      expect(createSuggester(a, { now }).suggest(query).ranked[0]?.category).toBe(original);
      expect(createSuggester(b, { now }).suggest(query).ranked[0]?.category).toBe(other);
    }
  });
});

describe("expectedCalibrationError", () => {
  it("is 0 for perfect calibration and grows with overconfidence", () => {
    const perfect = [...Array(8)].map((_, i) => ({ confidence: 0.75, correct: i < 6 }));
    expect(expectedCalibrationError(perfect)).toBeCloseTo(0, 12);
    const over = [...Array(10)].map((_, i) => ({ confidence: 0.95, correct: i < 5 }));
    expect(expectedCalibrationError(over)).toBeCloseTo(0.45, 12);
  });
});
