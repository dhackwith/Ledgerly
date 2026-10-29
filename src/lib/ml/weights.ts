/**
 * How much each saved expense counts as a training example (plan 3.2 "Example
 * weights" and "Recency").
 */
import { CATEGORIES, type Expense } from "@/lib/types";

export interface WeightParams {
  manual: number;
  import: number;
  /** Someone else's habits, so they count less. */
  sharedImport: number;
  /** An edit that changed the category is the strongest signal we get. */
  recategorized: number;
  /** Multiplier for an accepted pre-selected suggestion (acceptance-bias damping). */
  acceptedPreselect: number;
  halfLifeDays: number;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** When the label was last decided: the recategorization time, else the expense date. */
export function labelTime(e: Expense): number {
  const recat = e.meta?.recategorizedAt ? Date.parse(e.meta.recategorizedAt) : NaN;
  if (Number.isFinite(recat)) return recat;
  const date = DATE_RE.test(e.date) ? Date.parse(`${e.date}T12:00:00Z`) : NaN;
  if (Number.isFinite(date)) return date;
  const created = Date.parse(e.createdAt);
  return Number.isFinite(created) ? created : 0;
}

/** 0.5 ^ (age / half-life). Future-dated labels count as brand new. */
export function recencyFactor(ageMs: number, halfLifeDays: number): number {
  return Math.pow(0.5, Math.max(0, ageMs) / DAY_MS / halfLifeDays);
}

/**
 * Weight before recency. 0 means "never learn from this": sample data and
 * categories that are no longer valid.
 */
export function baseWeight(e: Expense, params: WeightParams, ignoreSuggestionMetaBefore: number | null): number {
  if (!(CATEGORIES as readonly string[]).includes(e.category)) return 0;
  const meta = e.meta;
  const source = meta?.source ?? "manual";
  if (source === "sample") return 0;
  if (meta?.recategorizedAt) return params.recategorized;
  let w = source === "shared-import" ? params.sharedImport : source === "import" ? params.import : params.manual;
  const s = meta?.suggestion;
  if (s && s.shown === "preselected" && s.accepted) {
    const created = Date.parse(e.createdAt);
    const ignored = ignoreSuggestionMetaBefore !== null && (!Number.isFinite(created) || created < ignoreSuggestionMetaBefore);
    if (!ignored) w *= params.acceptedPreselect;
  }
  return w;
}

export function exampleWeight(e: Expense, params: WeightParams, nowMs: number, ignoreSuggestionMetaBefore: number | null): number {
  const base = baseWeight(e, params, ignoreSuggestionMetaBefore);
  return base === 0 ? 0 : base * recencyFactor(nowMs - labelTime(e), params.halfLifeDays);
}
