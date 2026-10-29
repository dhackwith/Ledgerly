/**
 * Tuned constants and the calibration step (plan 3.2 "Blend and calibration").
 * The memory blend (step, dominance) and nbOrdinalDecay were swept by
 * prequential replay on the synthetic benchmark (src/lib/ml/benchmark); the
 * rest are hand-set and checked against the same gates. Bump MODEL_VERSION
 * when changing any of them.
 */
import { CATEGORIES, type Category } from "@/lib/types";
import type { RankedCategory } from "./contract";
import type { MemoryKind } from "./memory";
import type { NbParams, NbWeights } from "./naiveBayes";
import type { WeightParams } from "./weights";

export interface EngineParams {
  nb: NbParams;
  nbWeights: NbWeights;
  /** Per-occurrence decay of a description's older text mass in NB (1 = plain counting). */
  nbOrdinalDecay: number;
  /** Pseudo-count weight of each lexicon entry, in "real examples". */
  lexiconPseudo: number;
  /** Dirichlet prior on the lexicon-hit feature: P(hit says c | class c) starts high but is learnable. */
  lexHitPrior: { self: number; none: number; other: number };
  /** Dirichlet prior on the recurrence flag for Bills vs everything else. */
  recurPrior: { billsYes: number; billsNo: number; otherYes: number; otherNo: number };
  weights: WeightParams;
  memory: {
    ordinalDecay: number;
    fuzzyMin: number;
    keyCap: number;
    /** Dirichlet smoothing of the memory distribution. */
    beta: number;
    /** Base blend weight per match kind. */
    kindWeight: Readonly<Record<MemoryKind, number>>;
    /** Blend weight = kindWeight * similarity * (base + step * min(streak, streakCap)). */
    base: number;
    step: number;
    streakCap: number;
    /** At a full streak, NB logits are scaled by (1 - dominance). */
    dominance: number;
  };
  /** Logit bonus for the category of a matching expense about a month earlier. */
  recurrenceBoost: number;
  /** Divides blended logits before the softmax. */
  temperature: number;
  /** Subtracted from the "Other" logit: it's a junk drawer, so it needs extra evidence. */
  otherPenalty: number;
  /** "Other" leads only when it beats the runner-up by this much probability. */
  otherMargin: number;
  /** Top two closer than this count as ambiguous: chips, never pre-select. */
  closeMargin: number;
  /** Shown entries below this probability are dropped from `ranked`. */
  minListedP: number;
}

export const DEFAULT_PARAMS: EngineParams = {
  nb: { alphaText: 0.02, alphaCat: 1, priorAlpha: 2, vocabCap: 50_000 },
  // Group order follows TEXT_GROUPS (c, w, b, m) and CAT_GROUPS (lex, amount, dom, week, recur).
  nbWeights: { prior: 1, text: [1.5, 1.0, 0.3, 0.8], cat: [1.0, 0.6, 0.3, 0.2, 0.6] },
  nbOrdinalDecay: 0.4,
  lexiconPseudo: 2,
  lexHitPrior: { self: 6, none: 2, other: 0.3 },
  recurPrior: { billsYes: 2, billsNo: 2, otherYes: 0.5, otherNo: 4 },
  weights: { manual: 1, import: 1, sharedImport: 0.3, recategorized: 2, acceptedPreselect: 0.7, halfLifeDays: 180 },
  memory: {
    ordinalDecay: 0.6,
    fuzzyMin: 0.5,
    keyCap: 20_000,
    beta: 0.3,
    kindWeight: { exact: 1, token: 0.7, prefix: 0.5, fuzzy: 0.6 },
    base: 0.5,
    step: 2,
    streakCap: 4,
    dominance: 0.7,
  },
  recurrenceBoost: 2,
  temperature: 1.5,
  otherPenalty: 0.7,
  otherMargin: 0.15,
  closeMargin: 0.15,
  minListedP: 0.05,
};

const OTHER = CATEGORIES.indexOf("Other");

/** Applies the "Other" penalty and temperature, then a numerically stable softmax. */
export function calibrate(logits: ArrayLike<number>, temperature: number, otherPenalty: number): Float64Array {
  const z = Float64Array.from(logits);
  z[OTHER] -= otherPenalty;
  let max = -Infinity;
  for (let i = 0; i < z.length; i++) {
    z[i] /= temperature;
    if (z[i] > max) max = z[i];
  }
  let sum = 0;
  for (let i = 0; i < z.length; i++) sum += (z[i] = Math.exp(z[i] - max));
  for (let i = 0; i < z.length; i++) z[i] /= sum;
  return z;
}

/**
 * All categories, most likely first (ties in CATEGORIES order, for
 * determinism). "Other" may lead only with a clear margin; otherwise it
 * drops behind the runner-up. Returns whether that happened.
 */
export function rankCategories(probs: ArrayLike<number>, otherMargin: number): { ranked: RankedCategory[]; otherDemoted: boolean } {
  const ranked = CATEGORIES.map((category: Category, i) => ({ category, p: probs[i] })).sort(
    (a, b) => b.p - a.p || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category),
  );
  if (ranked[0].category === "Other" && ranked[0].p - ranked[1].p < otherMargin) {
    [ranked[0], ranked[1]] = [ranked[1], ranked[0]];
    return { ranked, otherDemoted: true };
  }
  return { ranked, otherDemoted: false };
}
