import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/types";
import { generateUser } from "../benchmark/generator";
import { createSuggester } from "../index";
import { buildModel } from "../suggester";

/**
 * Plan 1.8 / 7.3: < 50 ms rebuild of 5,000 expenses and < 5 ms predictions.
 * The asserted limits leave 10x headroom for slow CI machines.
 */
function bigHistory(n: number): Expense[] {
  const out: Expense[] = [];
  for (let seed = 900; out.length < n; seed++) {
    out.push(...generateUser(seed, { days: 730, ratePerDay: 2 }).items.map((i, k) => ({ ...i.expense, id: `${seed}-${k}` })));
  }
  return out.slice(0, n);
}

describe("performance", () => {
  const history = bigHistory(5000);
  const now = new Date("2028-02-01T00:00:00Z");

  it("builds a model from 5,000 expenses well within budget", () => {
    createSuggester(history.slice(0, 200), { now }); // warm up the JIT and the lexicon prior
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      createSuggester(history, { now });
      times.push(performance.now() - start);
    }
    expect(Math.min(...times)).toBeLessThan(500);
  });

  it("predicts with p95 well within budget, including typo and prefix lookups", () => {
    const model = buildModel(history, { now });
    const queries = history.slice(0, 400).map((e) => ({ description: e.description, amount: e.amount, date: e.date, mode: "create" as const }));
    for (const d of ["sta", "starb", "starbuks", "golden drgon", "zzzz qqqq", "a".repeat(120)]) queries.push({ description: d, amount: 10, date: "2028-01-31", mode: "create" });
    const times = queries.map((q) => {
      const start = performance.now();
      model.suggest(q);
      return performance.now() - start;
    });
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(20);
  });

  it("survives a huge import without freezing", () => {
    const huge: Expense[] = Array.from({ length: 30_000 }, (_, i) => ({
      id: `h${i}`,
      date: "2027-06-01",
      amount: (i % 500) + 1,
      category: "Shopping",
      description: `imported merchant ${i.toString(36)} ${((i * 2654435761) >>> 0).toString(36)}`,
      createdAt: "2027-06-01T10:00:00.000Z",
      updatedAt: "2027-06-01T10:00:00.000Z",
      meta: { source: "import" },
    }));
    const start = performance.now();
    const model = buildModel(huge, { now });
    expect(performance.now() - start).toBeLessThan(5000);
    expect(model.vocabularySize).toBeLessThanOrEqual(50_000);
    expect(model.suggest({ description: "uber", mode: "create" }).ranked[0].category).toBe("Transportation");
  }, 20_000);
});
