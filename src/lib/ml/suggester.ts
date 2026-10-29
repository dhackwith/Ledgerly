/**
 * The category suggester: normalize -> features -> [A] memory + [B] Naive
 * Bayes -> log-linear blend -> calibrate -> ranked output (plan 3.2).
 *
 * The model is derived from the expense list on every build (plan D2), so
 * there is nothing to persist or migrate. Pure: no DOM, storage, timers or
 * network.
 */
import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import { DEFAULT_PARAMS, calibrate, rankCategories, type EngineParams } from "./calibration";
import {
  CHIPS_THRESHOLD,
  EDIT_DISAGREE_THRESHOLD,
  PRESELECT_THRESHOLD,
  noSuggestion,
  type RankedCategory,
  type Suggester,
  type SuggesterOptions,
  type SuggestionQuery,
  type SuggestionResult,
} from "./contract";
import { LEX_NONE, RecurrenceIndex, contextFeatures, merchantAmountFeature, parseDate, textFeatures, type CatFeature } from "./features";
import { lexiconIndex, matchLexicon, type LexiconHit } from "./lexicon";
import { MerchantMemory, type MemoryHit } from "./memory";
import { K, NaiveBayes, PriorCounts } from "./naiveBayes";
import { isUninformative, normalizeDescription, tokenize } from "./normalize";
import { MODEL_VERSION } from "./version";
import { exampleWeight, labelTime } from "./weights";

const BILLS = CATEGORIES.indexOf("Bills");
const RECUR_GROUP = 4;

const priorCache = new WeakMap<EngineParams, PriorCounts>();

/** Lexicon pseudo-counts for the given parameters. Built once per parameter set. */
export function lexiconPrior(params: EngineParams): PriorCounts {
  const cached = priorCache.get(params);
  if (cached) return cached;
  const prior = new PriorCounts();
  lexiconIndex().forEach((category, key) => {
    prior.addText(textFeatures(key), CATEGORIES.indexOf(category), params.lexiconPseudo);
  });
  const { self, none, other } = params.lexHitPrior;
  const r = params.recurPrior;
  for (let c = 0; c < K; c++) {
    for (let v = 0; v <= LEX_NONE; v++) prior.addCat(0, v, c, v === c ? self : v === LEX_NONE ? none : other);
    prior.addCat(RECUR_GROUP, 1, c, c === BILLS ? r.billsYes : r.otherYes);
    prior.addCat(RECUR_GROUP, 0, c, c === BILLS ? r.billsNo : r.otherNo);
  }
  priorCache.set(params, prior);
  return prior;
}

/** Everything the model concluded about one query, before display rules. */
export interface Explanation {
  normalized: string;
  uninformative: boolean;
  /** Calibrated probability per CATEGORIES index. */
  probs: Float64Array;
  /** All categories in display order ("Other" may have been demoted). */
  ranked: RankedCategory[];
  otherDemoted: boolean;
  /** Memory evidence, strongest first. */
  memory: MemoryHit[];
  /** Sum of the memory blend weights (0 without memory evidence). */
  memoryWeight: number;
  recurring: boolean;
  lexiconHits: LexiconHit[];
}

function isUsable(e: Expense): boolean {
  return (
    !!e &&
    typeof e.description === "string" &&
    typeof e.date === "string" &&
    typeof e.amount === "number" &&
    (CATEGORIES as readonly string[]).includes(e.category)
  );
}

function argmax(values: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

function quote(label: string): string {
  const s = label.replace(/\s+/g, " ").trim();
  return s.length > 40 ? `${s.slice(0, 39)}\u2026` : s;
}

function times(n: number): string {
  return n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;
}

let warned = false;
function warnOnce(error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn("Category suggestions are unavailable:", error);
}

export class SuggesterModel implements Suggester {
  constructor(
    private readonly nb: NaiveBayes,
    private readonly memory: MerchantMemory,
    private readonly recurrence: RecurrenceIndex,
    private readonly params: EngineParams,
    /** Number of training examples; 0 means lexicon-only. */
    readonly trainingSize: number,
  ) {}

  get vocabularySize(): number {
    return this.nb.vocabularySize;
  }

  explain(query: SuggestionQuery): Explanation {
    const p = this.params;
    const normalized = normalizeDescription(query.description);
    const tokens = tokenize(normalized);
    const date = parseDate(query.date);
    const amount = typeof query.amount === "number" && Number.isFinite(query.amount) && query.amount >= 0 ? query.amount : undefined;
    const recurrence = date && amount !== undefined ? this.recurrence.find(normalized, date.dayNumber, amount) : null;
    const recurring = date && amount !== undefined ? recurrence !== null : null;

    const text = textFeatures(normalized);
    const ma = merchantAmountFeature(tokens, amount);
    if (ma) text.set(ma, 1);
    const cat: CatFeature[] = contextFeatures({ tokens, amount, date, recurring });
    const nbLogits = this.nb.scores(text, cat, p.nbWeights);

    // Log-linear blend. Each memory hit adds lambda * log P_memory(c), where
    // lambda grows with the run of consistent recent labels; a strong run also
    // shrinks the NB share, so memory dominates once a habit is established.
    const m = p.memory;
    const memory = this.memory.lookup(normalized, tokens);
    const memLogits = new Float64Array(K);
    let memoryWeight = 0;
    let dominance = 0;
    for (const hit of memory) {
      const e = hit.entry;
      const streak = Math.min(e.streakWeight, m.streakCap);
      const scale = m.kindWeight[hit.kind] * hit.similarity;
      const lambda = scale * (m.base + m.step * streak);
      memoryWeight += lambda;
      dominance = Math.max(dominance, m.dominance * scale * (streak / m.streakCap));
      let total = 0;
      for (let c = 0; c < K; c++) total += e.weights[c];
      for (let c = 0; c < K; c++) memLogits[c] += lambda * Math.log((e.weights[c] + m.beta) / (total + K * m.beta));
    }
    const logits = new Float64Array(K);
    for (let c = 0; c < K; c++) logits[c] = (1 - dominance) * nbLogits[c] + memLogits[c];
    // Same description and amount as about a month ago: likely the same category as then.
    if (recurrence) logits[recurrence.category] += p.recurrenceBoost;

    const probs = calibrate(logits, p.temperature, p.otherPenalty);
    const { ranked, otherDemoted } = rankCategories(probs, p.otherMargin);
    return {
      normalized,
      uninformative: isUninformative(normalized),
      probs,
      ranked,
      otherDemoted,
      memory,
      memoryWeight,
      recurring: recurrence !== null,
      lexiconHits: matchLexicon(tokens),
    };
  }

  suggest(query: SuggestionQuery): SuggestionResult {
    try {
      return this.decide(query, this.explain(query));
    } catch (error) {
      // Suggestions must never break the form (plan 6.3).
      warnOnce(error);
      return noSuggestion(MODEL_VERSION);
    }
  }

  /** Display rules (plan 5.2) applied to an explanation. */
  decide(query: SuggestionQuery, ex: Explanation): SuggestionResult {
    if (ex.uninformative) return noSuggestion(MODEL_VERSION);
    const list = (items: RankedCategory[]) => items.slice(0, 3).filter((r, i) => i === 0 || r.p >= this.params.minListedP);

    if (query.mode === "edit") {
      // Never pre-select in edit mode; only speak up when the model strongly disagrees.
      const alt = ex.ranked.find((r) => r.category !== query.currentCategory);
      if (!alt || alt.p < EDIT_DISAGREE_THRESHOLD) return noSuggestion(MODEL_VERSION);
      const ranked = list([alt, ...ex.ranked.filter((r) => r !== alt)]);
      return { ranked, confidence: alt.p, display: "chips", reason: this.reason(ex, alt.category), modelVersion: MODEL_VERSION };
    }

    const [top, second] = ex.ranked;
    const ambiguous = ex.otherDemoted || top.p - second.p < this.params.closeMargin;
    let display: SuggestionResult["display"] = "none";
    if (!ambiguous && top.p >= PRESELECT_THRESHOLD) display = "preselected";
    else if (top.p >= CHIPS_THRESHOLD || (ambiguous && top.p + second.p >= CHIPS_THRESHOLD)) display = "chips";
    if (display === "none") return noSuggestion(MODEL_VERSION);
    return { ranked: list(ex.ranked), confidence: top.p, display, reason: this.reason(ex, top.category), modelVersion: MODEL_VERSION };
  }

  /** Short explanation from the strongest evidence for `category`. */
  reason(ex: Explanation, category: Category): string {
    const c = CATEGORIES.indexOf(category);
    if (ex.recurring && category === "Bills") return "Looks like a monthly bill (same amount as last month)";
    const mem = ex.memory.find((h) => h.entry.counts[c] > 0 && argmax(h.entry.weights) === c);
    if (mem && (mem.kind === "exact" || mem.kind === "token")) {
      return `You filed '${quote(mem.entry.label)}' as ${category} ${times(mem.entry.counts[c])}`;
    }
    if (mem) return `Similar to '${quote(mem.entry.label)}', which you filed as ${category}`;
    const hit = ex.lexiconHits.find((h) => h.category === category);
    if (hit) return `'${hit.key}' is usually ${category}`;
    if (ex.recurring) return "Repeats monthly at about the same amount";
    return this.trainingSize > 0 ? `Similar to expenses you filed as ${category}` : `Commonly filed as ${category}`;
  }
}

/** Builds the model from saved expenses. Malformed records and sample data are skipped. */
export function buildModel(expenses: readonly Expense[], options: SuggesterOptions = {}, params: EngineParams = DEFAULT_PARAMS): SuggesterModel {
  const nowMs = (options.now ?? new Date()).getTime();
  const cutoffRaw = options.ignoreSuggestionMetaBefore ? Date.parse(options.ignoreSuggestionMetaBefore) : NaN;
  const cutoff = Number.isFinite(cutoffRaw) ? cutoffRaw : null;

  const items = expenses
    .filter(isUsable)
    .map((e) => ({ e, t: labelTime(e), w: exampleWeight(e, params.weights, nowMs, cutoff) }))
    .filter((it) => it.w > 0)
    // Oldest label first; ties broken by createdAt then id so builds are deterministic.
    .sort((a, b) => a.t - b.t || (a.e.createdAt < b.e.createdAt ? -1 : a.e.createdAt > b.e.createdAt ? 1 : 0) || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0));

  const nb = new NaiveBayes(params.nb, lexiconPrior(params));
  const memory = new MerchantMemory(params.memory);
  const recurrence = new RecurrenceIndex();

  // Pass 1: normalize once per description and index amounts by date for the recurrence flag.
  const prepared = new Map<string, { normalized: string; tokens: string[] }>();
  const rows = items.map((it) => {
    let prep = prepared.get(it.e.description);
    if (!prep) {
      const normalized = normalizeDescription(it.e.description);
      prepared.set(it.e.description, (prep = { normalized, tokens: tokenize(normalized) }));
    }
    const date = parseDate(it.e.date);
    const c = CATEGORIES.indexOf(it.e.category);
    if (date) recurrence.add(prep.normalized, date.dayNumber, it.e.amount, c);
    return { ...it, ...prep, date, c };
  });

  // Pass 2: learn. Text features depend only on the description, so their mass
  // is accumulated per description and learned once. Within one description
  // (and one merchant x amount key) older labels decay per occurrence, like the
  // memory: a merchant's text evidence saturates instead of growing without
  // bound, so a habit change can win and frequent merchants don't drown out
  // the rest of the vocabulary.
  const decay = params.nbOrdinalDecay;
  const textMass = new Map<string, { w: Float64Array; tick: number }>();
  const accumulate = (key: string, c: number, w: number, tick: number) => {
    let agg = textMass.get(key);
    if (!agg) textMass.set(key, (agg = { w: new Float64Array(K), tick }));
    for (let k = 0; k < K; k++) agg.w[k] *= decay;
    agg.w[c] += w;
    agg.tick = tick;
  };
  rows.forEach((r, tick) => {
    nb.learnClass(r.c, r.w);
    memory.add(r.normalized, r.tokens, r.e.description, r.c, r.w, tick);
    const amount = Number.isFinite(r.e.amount) && r.e.amount >= 0 ? r.e.amount : undefined;
    const recurring = r.date ? recurrence.isRecurring(r.normalized, r.date.dayNumber, amount) : null;
    for (const f of contextFeatures({ tokens: r.tokens, amount, date: r.date, recurring })) nb.learnCat(f, r.c, r.w);
    const ma = merchantAmountFeature(r.tokens, amount);
    if (ma) accumulate(ma, r.c, r.w, tick);
    if (r.normalized) accumulate(r.normalized, r.c, r.w, tick);
  });
  // Learn in last-seen order: NB prunes the least recently learned features first.
  const aggregated = Array.from(textMass.entries()).sort((a, b) => a[1].tick - b[1].tick);
  for (const [key, agg] of aggregated) {
    // "m:" keys are already features; anything else is a normalized description (which never contains ":" at index 1).
    const features = key.startsWith("m:") ? new Map([[key, 1]]) : textFeatures(key);
    for (let c = 0; c < K; c++) if (agg.w[c] > 0) nb.learnText(features, c, agg.w[c]);
  }
  nb.prune();
  memory.prune();

  return new SuggesterModel(nb, memory, recurrence, params, rows.length);
}
