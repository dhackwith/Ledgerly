/**
 * Prequential replay (plan 8.3): for each synthetic user, walk the expenses in
 * createdAt order, predict from everything saved so far, record, then save the
 * expense the way the form would (with meta.suggestion) and move on. The model
 * is rebuilt from scratch at every step through the same code path as
 * createSuggester, so the numbers describe exactly what ships.
 */
import { CATEGORIES, type Category, type Expense, type SuggestionDisplay } from "@/lib/types";
import { DEFAULT_PARAMS, type EngineParams } from "../calibration";
import type { SuggestionQuery } from "../contract";
import { buildModel } from "../suggester";
import { MODEL_VERSION } from "../version";
import type { SyntheticUser } from "./generator";

export interface ReplayRecord {
  index: number;
  truth: Category;
  merchant: string;
  drifted: boolean;
  /** Every category in the model's display order. */
  order: Category[];
  /** Calibrated probability of order[0]. */
  confidence: number;
  display: SuggestionDisplay;
  /** What the form would have shown (empty for "none"). */
  shown: Category[];
}

export function replayUser(user: SyntheticUser, params: EngineParams = DEFAULT_PARAMS): ReplayRecord[] {
  const history: Expense[] = [];
  const records: ReplayRecord[] = [];
  user.items.forEach((item, index) => {
    const e = item.expense;
    const model = buildModel(history, { now: new Date(e.createdAt) }, params);
    const query: SuggestionQuery = { description: e.description, amount: e.amount, date: e.date, mode: "create" };
    const ex = model.explain(query);
    const result = model.decide(query, ex);
    records.push({
      index,
      truth: e.category,
      merchant: item.merchant,
      drifted: item.drifted,
      order: ex.ranked.map((r) => r.category),
      confidence: ex.ranked[0].p,
      display: result.display,
      shown: result.ranked.map((r) => r.category),
    });
    const suggested = result.ranked[0]?.category;
    history.push({
      ...e,
      meta: {
        source: "manual",
        ...(suggested && {
          suggestion: { category: suggested, confidence: result.confidence, shown: result.display, accepted: suggested === e.category, modelVersion: MODEL_VERSION },
        }),
      },
    });
  });
  return records;
}

export interface ReplayMetrics {
  predictions: number;
  /** Top-1 over each user's first `earlyCount` expenses (mostly lexicon). */
  earlyTop1: number;
  /** Top-1 and top-3 from each user's `warmFrom`-th expense on. */
  warmTop1: number;
  warmTop3: number;
  overallTop1: number;
  preselected: number;
  /** Share of pre-selected suggestions that were right. */
  preselectPrecision: number;
  /** Pre-select precision over each user's first `earlyCount` expenses (lexicon-driven). */
  earlyPreselectPrecision: number;
  /** Share of all predictions that were pre-selected. */
  preselectCoverage: number;
  /** Share of chip displays that contained the right category. */
  chipsHit: number;
  /** Expected calibration error of order[0]'s confidence, equal-width bins. */
  ece: number;
  perClassRecall: Record<Category, number>;
  /** Mean number of wrong predictions on a drifted merchant before the first right one. */
  driftLag: number | null;
  /** Top-1 on drifted merchants from their 4th post-change occurrence on. */
  driftSettledTop1: number | null;
}

const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);

export function expectedCalibrationError(points: readonly { confidence: number; correct: boolean }[], bins = 10): number {
  const count = new Array(bins).fill(0);
  const conf = new Array(bins).fill(0);
  const hits = new Array(bins).fill(0);
  for (const p of points) {
    const b = Math.min(bins - 1, Math.floor(p.confidence * bins));
    count[b]++;
    conf[b] += p.confidence;
    hits[b] += p.correct ? 1 : 0;
  }
  let ece = 0;
  for (let b = 0; b < bins; b++) if (count[b]) ece += (count[b] / points.length) * Math.abs(hits[b] / count[b] - conf[b] / count[b]);
  return ece;
}

export function summarize(users: readonly ReplayRecord[][], earlyCount = 10, warmFrom = 50): ReplayMetrics {
  const all = users.flat();
  const top1 = (r: ReplayRecord) => r.order[0] === r.truth;
  const early = all.filter((r) => r.index < earlyCount);
  const warm = all.filter((r) => r.index >= warmFrom);
  const pre = all.filter((r) => r.display === "preselected");
  const chips = all.filter((r) => r.display === "chips");

  const perClassRecall = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    const rows = all.filter((r) => r.truth === c);
    perClassRecall[c] = ratio(rows.filter(top1).length, rows.length);
  }

  const lags: number[] = [];
  const settled: ReplayRecord[] = [];
  for (const records of users) {
    const drifted = records.filter((r) => r.drifted);
    if (!drifted.length) continue;
    const firstRight = drifted.findIndex(top1);
    lags.push(firstRight < 0 ? drifted.length : firstRight);
    settled.push(...drifted.slice(3));
  }

  return {
    predictions: all.length,
    earlyTop1: ratio(early.filter(top1).length, early.length),
    warmTop1: ratio(warm.filter(top1).length, warm.length),
    warmTop3: ratio(warm.filter((r) => r.order.slice(0, 3).includes(r.truth)).length, warm.length),
    overallTop1: ratio(all.filter(top1).length, all.length),
    preselected: pre.length,
    preselectPrecision: ratio(pre.filter(top1).length, pre.length),
    earlyPreselectPrecision: ratio(early.filter((r) => r.display === "preselected" && top1(r)).length, early.filter((r) => r.display === "preselected").length),
    preselectCoverage: ratio(pre.length, all.length),
    chipsHit: ratio(chips.filter((r) => r.shown.includes(r.truth)).length, chips.length),
    ece: expectedCalibrationError(all.map((r) => ({ confidence: r.confidence, correct: top1(r) }))),
    perClassRecall,
    driftLag: lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null,
    driftSettledTop1: settled.length ? ratio(settled.filter(top1).length, settled.length) : null,
  };
}
