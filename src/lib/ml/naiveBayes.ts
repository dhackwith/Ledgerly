/**
 * Weighted multinomial Naive Bayes over grouped sparse features (plan 3.2 [B]).
 *
 * Each text group is its own multinomial and each categorical group its own
 * categorical distribution, all with Lidstone smoothing. Static prior counts
 * (the lexicon) are kept apart from the user's counts and added at scoring
 * time, so building never copies them. Learning is a counting pass.
 */
import { CATEGORIES } from "@/lib/types";
import { CAT_GROUPS, CAT_SIZES, TEXT_GROUPS, type CatFeature } from "./features";

export const K = CATEGORIES.length;
const G_TEXT = TEXT_GROUPS.length;
const G_CAT = CAT_GROUPS.length;
const CAT_SIZE_LIST = CAT_GROUPS.map((g) => CAT_SIZES[g]);
const GROUP_OF: Record<string, number> = Object.fromEntries(TEXT_GROUPS.map((g, i) => [g, i]));

export interface NbParams {
  /** Lidstone alpha for text features (per-feature mass is fractional, so this is small). */
  alphaText: number;
  /** Lidstone alpha for categorical groups. */
  alphaCat: number;
  /** Dirichlet alpha for the class prior. */
  priorAlpha: number;
  /** Plan 4.3: max distinct user text features; least-recently-seen are pruned. */
  vocabCap: number;
}

/** Fixed pseudo-counts, e.g. from the lexicon. Never mutated after construction. */
export class PriorCounts {
  readonly text = new Map<string, Float64Array>();
  readonly textTotals = Array.from({ length: G_TEXT }, () => new Float64Array(K));
  readonly textVocab = new Int32Array(G_TEXT);
  /** Per categorical group, a flattened [value * K + class] table. */
  readonly cat = CAT_SIZE_LIST.map((size) => new Float64Array(size * K));

  addText(features: ReadonlyMap<string, number>, c: number, w: number): void {
    features.forEach((fw, key) => {
      const g = GROUP_OF[key[0]];
      let row = this.text.get(key);
      if (!row) {
        this.text.set(key, (row = new Float64Array(K)));
        this.textVocab[g]++;
      }
      row[c] += fw * w;
      this.textTotals[g][c] += fw * w;
    });
  }

  addCat(group: number, value: number, c: number, w: number): void {
    this.cat[group][value * K + c] += w;
  }
}

const EMPTY_PRIOR = new PriorCounts();

/** Per-group scoring weights; these act as per-group temperatures. */
export interface NbWeights {
  prior: number;
  text: readonly number[];
  cat: readonly number[];
}

export class NaiveBayes {
  /** Per feature: K class counts, then the stamp of the last learnText call that touched it. */
  private readonly text = new Map<string, Float64Array>();
  private readonly textTotals = Array.from({ length: G_TEXT }, () => new Float64Array(K));
  /** User features that the prior doesn't already know (they grow the vocabulary). */
  private readonly newVocab = new Int32Array(G_TEXT);
  private readonly cat = CAT_SIZE_LIST.map((size) => new Float64Array(size * K));
  private readonly classMass = new Float64Array(K);
  private seq = 0;

  constructor(
    private readonly params: NbParams,
    private readonly prior: PriorCounts = EMPTY_PRIOR,
  ) {}

  get vocabularySize(): number {
    return this.text.size;
  }

  learnClass(c: number, w: number): void {
    this.classMass[c] += w;
  }

  /**
   * Adds weighted text features. Each call stamps its features with an
   * increasing sequence number, so callers that learn oldest first get
   * least-recently-seen pruning.
   */
  learnText(features: ReadonlyMap<string, number>, c: number, w: number): void {
    const stamp = ++this.seq;
    features.forEach((fw, key) => {
      const g = GROUP_OF[key[0]];
      let row = this.text.get(key);
      if (!row) {
        this.text.set(key, (row = new Float64Array(K + 1)));
        if (!this.prior.text.has(key)) this.newVocab[g]++;
      }
      row[c] += fw * w;
      row[K] = stamp;
      this.textTotals[g][c] += fw * w;
    });
    // Prune in large batches so a huge import stays near-linear.
    const cap = this.params.vocabCap;
    if (this.text.size > cap * 1.2) this.prune(Math.max(1, Math.floor(cap * 0.8)));
  }

  learnCat(f: CatFeature, c: number, w: number): void {
    this.cat[f.group][f.value * K + c] += f.w * w;
  }

  /** Drops least-recently-seen user features until at most `target` remain. */
  prune(target = this.params.vocabCap): void {
    let excess = this.text.size - target;
    if (excess <= 0) return;
    // Find the stamp cut-off with a typed-array sort, then delete the oldest in one pass.
    const stamps = new Float64Array(this.text.size);
    let i = 0;
    this.text.forEach((row) => (stamps[i++] = row[K]));
    stamps.sort();
    const cutoff = stamps[excess - 1];
    this.text.forEach((row, key) => {
      // Ties at the cut-off are broken by map (insertion) order, which is deterministic.
      if (excess <= 0 || row[K] > cutoff) return;
      const g = GROUP_OF[key[0]];
      for (let c = 0; c < K; c++) this.textTotals[g][c] -= row[c];
      if (!this.prior.text.has(key)) this.newVocab[g]--;
      this.text.delete(key);
      excess--;
    });
  }

  logPrior(c: number): number {
    let total = 0;
    for (let k = 0; k < K; k++) total += this.classMass[k];
    return Math.log((this.classMass[c] + this.params.priorAlpha) / (total + K * this.params.priorAlpha));
  }

  /** log P(feature | class) within its group, or null when no one has ever seen it. */
  textLogProb(key: string, c: number): number | null {
    const row = this.text.get(key);
    const p = this.prior.text.get(key);
    if (!row && !p) return null;
    const g = GROUP_OF[key[0]];
    const a = this.params.alphaText;
    const vocab = this.prior.textVocab[g] + this.newVocab[g];
    const num = (row ? row[c] : 0) + (p ? p[c] : 0) + a;
    const den = this.textTotals[g][c] + this.prior.textTotals[g][c] + a * vocab;
    return Math.log(num / den);
  }

  catLogProb(group: number, value: number, c: number): number {
    const size = CAT_SIZE_LIST[group];
    const a = this.params.alphaCat;
    const user = this.cat[group];
    const prior = this.prior.cat[group];
    let den = 0;
    for (let v = 0; v < size; v++) den += user[v * K + c] + prior[v * K + c] + a;
    return Math.log((user[value * K + c] + prior[value * K + c] + a) / den);
  }

  /** Unnormalized log posterior per class. Features unseen by everyone are skipped (they carry no evidence). */
  scores(text: ReadonlyMap<string, number>, cat: readonly CatFeature[], weights: NbWeights): Float64Array {
    const out = new Float64Array(K);
    for (let c = 0; c < K; c++) out[c] = weights.prior * this.logPrior(c);
    text.forEach((fw, key) => {
      if (!this.text.has(key) && !this.prior.text.has(key)) return;
      const gw = weights.text[GROUP_OF[key[0]]] * fw;
      for (let c = 0; c < K; c++) out[c] += gw * (this.textLogProb(key, c) as number);
    });
    for (const f of cat) {
      const gw = weights.cat[f.group] * f.w;
      for (let c = 0; c < K; c++) out[c] += gw * this.catLogProb(f.group, f.value, c);
    }
    return out;
  }

  /** Weighted examples seen per class (used for reasons and diagnostics). */
  classTotals(): Float64Array {
    return this.classMass.slice();
  }
}

export { G_CAT, G_TEXT };
