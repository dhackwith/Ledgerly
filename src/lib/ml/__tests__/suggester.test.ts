import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, type Category, type Expense, type ExpenseMeta } from "@/lib/types";
import { DEFAULT_PARAMS, calibrate, rankCategories, type EngineParams } from "../calibration";
import { CHIPS_THRESHOLD, EDIT_DISAGREE_THRESHOLD, PRESELECT_THRESHOLD, type SuggestionQuery } from "../contract";
import { MODEL_VERSION, createSuggester } from "../index";
import { buildModel, type Explanation } from "../suggester";

const NOW = new Date("2026-06-01T20:00:00Z");
let seq = 0;

function exp(description: string, category: Category, date = "2026-05-01", amount = 12, meta?: ExpenseMeta): Expense {
  seq++;
  const createdAt = `${date}T12:00:${String(seq % 60).padStart(2, "0")}.000Z`;
  return { id: `e${seq}`, date, amount, category, description, createdAt, updatedAt: createdAt, meta };
}

/** n expenses on consecutive days starting at `start`. */
function series(description: string, category: Category, n: number, start = "2026-03-01", amount = 12): Expense[] {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => exp(description, category, new Date(base + i * 86_400_000).toISOString().slice(0, 10), amount));
}

const create = (description: string, extra: Partial<SuggestionQuery> = {}): SuggestionQuery => ({ description, amount: 12, date: "2026-06-01", mode: "create", ...extra });

/** An explanation with the given probabilities, for testing display rules in isolation. */
function fakeExplanation(probs: Partial<Record<Category, number>>): Explanation {
  const p = Float64Array.from(CATEGORIES.map((c) => probs[c] ?? 0));
  const { ranked, otherDemoted } = rankCategories(p, DEFAULT_PARAMS.otherMargin);
  return { normalized: "something real", uninformative: false, probs: p, ranked, otherDemoted, memory: [], memoryWeight: 0, recurring: false, lexiconHits: [] };
}

afterEach(() => vi.restoreAllMocks());

describe("output shape", () => {
  it("returns calibrated, ranked, versioned results on cold start", () => {
    const s = createSuggester([], { now: NOW });
    const r = s.suggest(create("Uber"));
    expect(r.display).toBe("preselected");
    expect(r.ranked[0].category).toBe("Transportation");
    expect(r.confidence).toBe(r.ranked[0].p);
    expect(r.confidence).toBeGreaterThanOrEqual(PRESELECT_THRESHOLD);
    expect(r.modelVersion).toBe(MODEL_VERSION);
    expect(r.reason).toBe("'uber' is usually Transportation");
    expect(r.ranked.length).toBeLessThanOrEqual(3);
  });

  it("produces a proper probability distribution in display order", () => {
    const model = buildModel([...series("Golden Dragon", "Food", 3), ...series("Amazon", "Shopping", 3)], { now: NOW });
    for (const d of ["golden dragon", "amazon", "uber", "zzzz", "星巴克"]) {
      const ex = model.explain(create(d));
      expect(ex.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      expect(ex.ranked).toHaveLength(CATEGORIES.length);
      for (const r of ex.ranked) expect(r.p).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(["", " ", "x", "misc", "Stuff", "test", "1234", "$$$", "n/a"])("suggests nothing for uninformative text %j", (d) => {
    const r = createSuggester([...series("misc", "Other", 5)], { now: NOW }).suggest(create(d));
    expect(r).toEqual({ ranked: [], confidence: 0, display: "none", reason: null, modelVersion: MODEL_VERSION });
  });

  it("stays quiet about unknown text without history", () => {
    expect(createSuggester([], { now: NOW }).suggest(create("golden dragon")).display).toBe("none");
  });
});

describe("create-mode display rules", () => {
  const model = buildModel([], { now: NOW });
  const decide = (probs: Partial<Record<Category, number>>) => model.decide(create("x y"), fakeExplanation(probs));

  it("pre-selects only at or above PRESELECT_THRESHOLD", () => {
    expect(decide({ Food: PRESELECT_THRESHOLD, Shopping: 1 - PRESELECT_THRESHOLD }).display).toBe("preselected");
    expect(decide({ Food: 0.84, Shopping: 0.16 }).display).toBe("chips");
  });

  it("shows chips from CHIPS_THRESHOLD, or when the top two are close", () => {
    expect(decide({ Food: CHIPS_THRESHOLD, Shopping: 0.2, Bills: 0.3 }).display).toBe("chips");
    expect(decide({ Food: 0.45, Shopping: 0.15, Bills: 0.4 }).display).toBe("chips");
    expect(decide({ Food: 0.4, Shopping: 0.2, Bills: 0.2, Other: 0.2 }).display).toBe("none");
    // Close but both weak: not worth showing.
    expect(decide({ Food: 0.22, Shopping: 0.2, Bills: 0.2, Other: 0.19, Transportation: 0.19 }).display).toBe("none");
  });

  it("returns an empty list for 'none' and drops negligible chips", () => {
    expect(decide({ Food: 0.25, Shopping: 0.2, Bills: 0.2, Other: 0.2, Transportation: 0.15 }).ranked).toEqual([]);
    const r = decide({ Food: 0.9, Shopping: 0.07, Bills: 0.03 });
    expect(r.ranked.map((x) => x.category)).toEqual(["Food", "Shopping"]);
  });

  it("puts 'Other' first only with a clear margin, and never pre-selects it otherwise", () => {
    const close = decide({ Other: 0.5, Food: 0.4, Shopping: 0.1 });
    expect(close.ranked.map((x) => x.category)).toEqual(["Food", "Other", "Shopping"]);
    expect(close.display).toBe("chips");
    expect(close.confidence).toBeCloseTo(0.4, 12);
    const clear = decide({ Other: 0.9, Food: 0.1 });
    expect(clear.ranked[0].category).toBe("Other");
    expect(clear.display).toBe("preselected");
  });
});

describe("edit-mode display rules", () => {
  const model = buildModel([], { now: NOW });
  const edit = (currentCategory: Category, probs: Partial<Record<Category, number>>) =>
    model.decide({ description: "x y", mode: "edit", currentCategory }, fakeExplanation(probs));

  it("never pre-selects", () => {
    expect(edit("Shopping", { Food: 0.99, Shopping: 0.01 }).display).toBe("chips");
    expect(edit("Food", { Food: 0.99, Shopping: 0.01 }).display).toBe("none");
  });

  it("speaks up only when another category reaches EDIT_DISAGREE_THRESHOLD", () => {
    const r = edit("Shopping", { Food: EDIT_DISAGREE_THRESHOLD, Shopping: 1 - EDIT_DISAGREE_THRESHOLD });
    expect(r.ranked[0]).toEqual({ category: "Food", p: EDIT_DISAGREE_THRESHOLD });
    expect(r.confidence).toBe(EDIT_DISAGREE_THRESHOLD);
    expect(edit("Shopping", { Food: 0.89, Shopping: 0.11 }).display).toBe("none");
  });

  it("works end to end: strong disagreement shows a chip, agreement shows nothing", () => {
    const s = createSuggester(series("Uber", "Transportation", 8), { now: NOW });
    expect(s.suggest({ description: "uber", mode: "edit", currentCategory: "Food" })).toMatchObject({ display: "chips", ranked: [{ category: "Transportation" }] });
    expect(s.suggest({ description: "uber", mode: "edit", currentCategory: "Transportation" }).display).toBe("none");
  });
});

describe("the 'Other' penalty", () => {
  it("lowers Other's calibrated probability", () => {
    const logits = [1, 0, 0, 0, 0, 1];
    const plain = calibrate(logits, 1, 0);
    const penalized = calibrate(logits, 1, DEFAULT_PARAMS.otherPenalty);
    expect(plain[5]).toBeCloseTo(plain[0], 12);
    expect(penalized[5]).toBeLessThan(penalized[0]);
    expect(penalized.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("applies inside the model", () => {
    const history = [...series("Riverside", "Other", 2), ...series("Riverside", "Food", 2, "2026-04-01")];
    const noPenalty: EngineParams = { ...DEFAULT_PARAMS, otherPenalty: 0 };
    const withPenalty = buildModel(history, { now: NOW }).explain(create("riverside")).probs[5];
    const without = buildModel(history, { now: NOW }, noPenalty).explain(create("riverside")).probs[5];
    expect(withPenalty).toBeLessThan(without);
  });
});

describe("learning", () => {
  it("explains memory hits with counts", () => {
    const r = createSuggester(series("Uber", "Transportation", 6), { now: NOW }).suggest(create("uber"));
    expect(r.reason).toBe("You filed 'Uber' as Transportation 6 times");
  });

  it("recognizes a monthly bill", () => {
    const history = ["2026-03-05", "2026-04-05", "2026-05-05"].map((d) => exp("Sonic Fiber", "Bills", d, 50));
    const r = createSuggester(history, { now: NOW }).suggest(create("Sonic Fiber", { amount: 50, date: "2026-06-05" }));
    expect(r.ranked[0].category).toBe("Bills");
    expect(r.reason).toBe("Looks like a monthly bill (same amount as last month)");
  });

  it("uses the amount to tell apart a subscription from shopping at the same merchant", () => {
    const prime = ["2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10"].map((d) => exp("amazon", "Bills", d, 14.99));
    const shopping = ["2026-02-03", "2026-02-20", "2026-03-04", "2026-03-22", "2026-04-02", "2026-04-25", "2026-05-03", "2026-05-20"].map((d, i) =>
      exp("amazon", "Shopping", d, 35 + i * 7),
    );
    const s = createSuggester([...prime, ...shopping], { now: new Date("2026-06-10T20:00:00Z") });
    expect(s.suggest(create("amazon", { amount: 14.99, date: "2026-06-10" })).ranked[0].category).toBe("Bills");
    expect(s.suggest(create("amazon", { amount: 64, date: "2026-06-08" })).ranked[0].category).toBe("Shopping");
  });

  it("personalizes: two users who file the same merchant differently each get their own answer", () => {
    const a = createSuggester(series("Blue Bottle", "Food", 4), { now: NOW });
    const b = createSuggester(series("Blue Bottle", "Entertainment", 4), { now: NOW });
    expect(a.suggest(create("blue bottle")).ranked[0].category).toBe("Food");
    expect(b.suggest(create("blue bottle")).ranked[0].category).toBe("Entertainment");
    // Even against the lexicon ("starbucks" is Food there).
    const c = createSuggester(series("Starbucks", "Entertainment", 3), { now: NOW });
    expect(c.suggest(create("Starbucks")).ranked[0].category).toBe("Entertainment");
  });

  it("follows a habit change within a few labels", () => {
    const old = series("Blue Bottle", "Food", 20, "2026-01-01");
    const predict = (extra: number) =>
      createSuggester([...old, ...series("Blue Bottle", "Other", extra, "2026-05-01")], { now: NOW }).suggest(create("blue bottle")).ranked[0]?.category;
    expect(predict(0)).toBe("Food");
    expect(predict(3)).toBe("Other");
  });

  it("generalizes from typos, prefixes and spelling variants", () => {
    const s = createSuggester([...series("Golden Dragon", "Food", 4), ...series("Riverside Rec", "Entertainment", 4)], { now: NOW });
    expect(s.suggest(create("golden dragn")).ranked[0].category).toBe("Food");
    expect(s.suggest(create("river")).ranked[0].category).toBe("Entertainment");
    expect(s.suggest(create("GOLDEN DRAGON #1234 SEATTLE WA")).ranked[0].category).toBe("Food");
  });

  it("skips categories that no longer exist", () => {
    const bad = series("Golden Dragon", "Groceries" as Category, 4);
    const s = createSuggester(bad, { now: NOW });
    expect(s.suggest(create("golden dragon"))).toEqual(createSuggester([], { now: NOW }).suggest(create("golden dragon")));
  });
});

describe("robustness", () => {
  const history = [
    ...series("Uber", "Transportation", 5),
    ...series("Golden Dragon", "Food", 4),
    ...series("Amazon", "Shopping", 6, "2026-04-01", 40),
    exp("Rent", "Bills", "2026-05-01", 1800),
  ];

  it("is deterministic and independent of input order", () => {
    const shuffled = [...history].reverse();
    const a = createSuggester(history, { now: NOW });
    const b = createSuggester(shuffled, { now: NOW });
    for (const d of ["uber", "golden dragon", "amazon", "rent", "goldn", "zzz qqq"]) {
      expect(b.suggest(create(d))).toEqual(a.suggest(create(d)));
      expect(a.suggest(create(d))).toEqual(a.suggest(create(d)));
    }
  });

  it("skips malformed records instead of failing", () => {
    const junk = [null, { id: "x" }, { ...history[0], description: 42 }, { ...history[0], amount: "12" }, { ...history[0], date: "garbage" }] as unknown as Expense[];
    const s = createSuggester([...history, ...junk], { now: NOW });
    expect(s.suggest(create("uber")).ranked[0].category).toBe("Transportation");
  });

  it("returns no suggestion instead of throwing on bad queries", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = createSuggester(history, { now: NOW });
    expect(s.suggest({ description: undefined as unknown as string, mode: "create" })).toEqual({
      ranked: [],
      confidence: 0,
      display: "none",
      reason: null,
      modelVersion: MODEL_VERSION,
    });
    expect(s.suggest({ description: "uber", amount: Number.NaN, date: "nope", mode: "create" }).ranked[0].category).toBe("Transportation");
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("keeps the vocabulary within its cap", () => {
    const params: EngineParams = { ...DEFAULT_PARAMS, nb: { ...DEFAULT_PARAMS.nb, vocabCap: 300 } };
    const many = Array.from({ length: 400 }, (_, i) => exp(`merchant ${i.toString(36)}x${(i * 7919).toString(36)}`, "Shopping"));
    const model = buildModel(many, { now: NOW }, params);
    expect(model.vocabularySize).toBeLessThanOrEqual(300);
    expect(model.suggest(create("uber")).ranked[0].category).toBe("Transportation");
  });

  it("is pure: the same history built twice gives identical explanations", () => {
    const a = buildModel(history, { now: NOW }).explain(create("amazon"));
    const b = buildModel(history, { now: NOW }).explain(create("amazon"));
    expect(Array.from(a.probs)).toEqual(Array.from(b.probs));
  });
});
