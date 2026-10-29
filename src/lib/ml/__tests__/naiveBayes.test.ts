import { describe, expect, it } from "vitest";
import { NaiveBayes, PriorCounts, type NbWeights } from "../naiveBayes";

const PARAMS = { alphaText: 1, alphaCat: 1, priorAlpha: 1, vocabCap: 1000 };
const UNIT: NbWeights = { prior: 1, text: [1, 1, 1, 1], cat: [1, 1, 1, 1, 1] };

/** Class 0 has two weighted examples of word "a"; class 1 has one of word "b". */
function tiny(prior?: PriorCounts): NaiveBayes {
  const nb = new NaiveBayes(PARAMS, prior);
  nb.learnClass(0, 2);
  nb.learnClass(1, 1);
  nb.learnText(new Map([["w:a", 1]]), 0, 2);
  nb.learnText(new Map([["w:b", 1]]), 1, 1);
  return nb;
}

describe("NaiveBayes", () => {
  it("computes the smoothed class prior", () => {
    const nb = tiny();
    // (mass + 1) / (3 + 6)
    expect(nb.logPrior(0)).toBeCloseTo(Math.log(3 / 9), 12);
    expect(nb.logPrior(1)).toBeCloseTo(Math.log(2 / 9), 12);
    expect(nb.logPrior(4)).toBeCloseTo(Math.log(1 / 9), 12);
  });

  it("computes Lidstone-smoothed feature likelihoods per group", () => {
    const nb = tiny();
    // Vocabulary of group "w" is 2. P(a|0) = (2+1)/(2+2); P(a|1) = (0+1)/(1+2); P(a|unseen class) = 1/2.
    expect(nb.textLogProb("w:a", 0)).toBeCloseTo(Math.log(3 / 4), 12);
    expect(nb.textLogProb("w:a", 1)).toBeCloseTo(Math.log(1 / 3), 12);
    expect(nb.textLogProb("w:b", 0)).toBeCloseTo(Math.log(1 / 4), 12);
    expect(nb.textLogProb("w:a", 5)).toBeCloseTo(Math.log(1 / 2), 12);
    expect(nb.textLogProb("w:never", 0)).toBeNull();
  });

  it("scores as log prior plus weighted log likelihoods", () => {
    const nb = tiny();
    const s = nb.scores(new Map([["w:a", 1]]), [], UNIT);
    expect(s[0]).toBeCloseTo(Math.log(3 / 9) + Math.log(3 / 4), 12);
    expect(s[1]).toBeCloseTo(Math.log(2 / 9) + Math.log(1 / 3), 12);
    const half = nb.scores(new Map([["w:a", 1]]), [], { ...UNIT, text: [1, 0.5, 1, 1] });
    expect(half[0]).toBeCloseTo(Math.log(3 / 9) + 0.5 * Math.log(3 / 4), 12);
  });

  it("skips features nobody has seen", () => {
    const nb = tiny();
    const s = nb.scores(new Map([["w:zzz", 1]]), [], UNIT);
    for (let c = 0; c < 6; c++) expect(s[c]).toBeCloseTo(nb.logPrior(c), 12);
  });

  it("handles categorical groups", () => {
    const nb = new NaiveBayes(PARAMS);
    nb.learnCat({ group: 1, value: 2, w: 1 }, 0, 1);
    // Amount group has 6 values: P(v=2 | 0) = (1+1)/(1+6), P(v=2 | 1) = 1/6.
    expect(nb.catLogProb(1, 2, 0)).toBeCloseTo(Math.log(2 / 7), 12);
    expect(nb.catLogProb(1, 2, 1)).toBeCloseTo(Math.log(1 / 6), 12);
    const s = nb.scores(new Map(), [{ group: 1, value: 2, w: 1 }], UNIT);
    expect(s[0] - s[1]).toBeCloseTo(Math.log(2 / 7) - Math.log(1 / 6), 12);
  });

  it("treats example weights as fractional counts", () => {
    const a = new NaiveBayes(PARAMS);
    a.learnText(new Map([["w:x", 1]]), 0, 0.5);
    const b = new NaiveBayes(PARAMS);
    b.learnText(new Map([["w:x", 0.5]]), 0, 1);
    expect(a.textLogProb("w:x", 0)).toBeCloseTo(b.textLogProb("w:x", 0) as number, 12);
    // (0.5+1)/(0.5+1)
    expect(a.textLogProb("w:x", 0)).toBeCloseTo(0, 12);
  });

  it("adds prior pseudo-counts and their vocabulary", () => {
    const prior = new PriorCounts();
    prior.addText(new Map([["w:a", 1]]), 1, 2);
    const nb = tiny(prior);
    // Vocab = 1 (prior) + 1 new user feature ("w:b"). P(a|1) = (0+2+1)/(1+2+2).
    expect(nb.textLogProb("w:a", 1)).toBeCloseTo(Math.log(3 / 5), 12);
    // P(a|0) = (2+0+1)/(2+0+2)
    expect(nb.textLogProb("w:a", 0)).toBeCloseTo(Math.log(3 / 4), 12);
    prior.addCat(0, 3, 1, 4);
    expect(nb.catLogProb(0, 3, 1)).toBeCloseTo(Math.log(5 / (4 + 7)), 12);
  });

  it("prunes least-recently-seen features to the vocabulary cap", () => {
    const nb = new NaiveBayes({ ...PARAMS, vocabCap: 10 });
    for (let i = 1; i <= 11; i++) nb.learnText(new Map([[`w:f${i}`, 1]]), 0, 1);
    nb.prune();
    expect(nb.vocabularySize).toBe(10);
    expect(nb.textLogProb("w:f1", 0)).toBeNull();
    // Totals shrink with the pruned feature: P(f2|0) = (1+1)/(10+10).
    expect(nb.textLogProb("w:f2", 0)).toBeCloseTo(Math.log(2 / 20), 12);
  });

  it("prunes in batches during learning, down to 80% of the cap", () => {
    const nb = new NaiveBayes({ ...PARAMS, vocabCap: 10 });
    for (let i = 1; i <= 13; i++) nb.learnText(new Map([[`w:f${i}`, 1]]), 0, 1);
    expect(nb.vocabularySize).toBe(8);
    for (const i of [1, 2, 3, 4, 5]) expect(nb.textLogProb(`w:f${i}`, 0)).toBeNull();
    expect(nb.textLogProb("w:f13", 0)).not.toBeNull();
  });

  it("refreshes recency on reuse, so recently used features survive", () => {
    const nb = new NaiveBayes({ ...PARAMS, vocabCap: 3 });
    for (const k of ["a", "b", "c", "a", "d"]) nb.learnText(new Map([[`w:${k}`, 1]]), 0, 1);
    // The 4th distinct feature exceeds 1.2x the cap, so the batch prune keeps the 2 most recent.
    expect(nb.vocabularySize).toBe(2);
    expect(nb.textLogProb("w:a", 0)).not.toBeNull();
    expect(nb.textLogProb("w:d", 0)).not.toBeNull();
    expect(nb.textLogProb("w:b", 0)).toBeNull();
    expect(nb.textLogProb("w:c", 0)).toBeNull();
  });

  it("is deterministic", () => {
    const f = new Map([
      ["w:a", 1],
      ["c:abc", 0.5],
      ["c:bcd", 0.5],
    ]);
    expect(Array.from(tiny().scores(f, [{ group: 2, value: 1, w: 1 }], UNIT))).toEqual(Array.from(tiny().scores(f, [{ group: 2, value: 1, w: 1 }], UNIT)));
  });
});
