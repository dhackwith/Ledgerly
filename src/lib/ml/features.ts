/**
 * Sparse features for the Naive Bayes layer (plan 3.2 [B]).
 *
 * Text features depend only on the normalized description, so callers cache
 * them per description. Each text group ("c" char n-grams, "w" words, "b"
 * bigrams) is normalized to total weight 1, so long descriptions don't
 * out-vote short ones. Context features (lexicon hit, amount, day of month,
 * weekday, recurrence) are small categorical groups.
 */
import { CATEGORIES } from "@/lib/types";
import { matchLexicon } from "./lexicon";
import { tokenize } from "./normalize";

/** Plan 4.3: bound the work any single expense can cause. */
export const MAX_FEATURES_PER_EXPENSE = 200;

/** Text feature groups, identified by the key's first character. */
export const TEXT_GROUPS = ["c", "w", "b", "m"] as const;
export type TextGroup = (typeof TEXT_GROUPS)[number];

/** Categorical groups and how many values each has. */
export const CAT_GROUPS = ["lex", "amount", "dom", "week", "recur"] as const;
export type CatGroup = (typeof CAT_GROUPS)[number];
export const CAT_SIZES: Readonly<Record<CatGroup, number>> = {
  lex: CATEGORIES.length + 1, // one value per category, plus "no hit"
  amount: 6,
  dom: 3,
  week: 2,
  recur: 2,
};
export const LEX_NONE = CATEGORIES.length;

/** One categorical observation; `w` lets a group split its mass (several lexicon hits). */
export interface CatFeature {
  group: number;
  value: number;
  w: number;
}

const AMOUNT_BOUNDS = [5, 15, 40, 100, 300];

/** Log-scaled bands: <5, 5-15, 15-40, 40-100, 100-300, 300+. */
export function amountBand(amount: number): number {
  let band = 0;
  while (band < AMOUNT_BOUNDS.length && amount >= AMOUNT_BOUNDS[band]) band++;
  return band;
}

/** Day of month 1-5, 6-25, 26-31: rent and bills cluster at the ends. */
export function domBand(dayOfMonth: number): number {
  return dayOfMonth <= 5 ? 0 : dayOfMonth <= 25 ? 1 : 2;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface DateParts {
  /** Days since 1970-01-01 (UTC calendar arithmetic, so no time-zone drift). */
  dayNumber: number;
  dayOfMonth: number;
  weekend: boolean;
}

export function parseDate(date: string | undefined): DateParts | null {
  if (!date) return null;
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(ms)) return null;
  const dayNumber = Math.floor(ms / DAY_MS);
  const weekday = (((dayNumber + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday; 0 = Sunday
  return { dayNumber, dayOfMonth: Number(m[3]), weekend: weekday === 0 || weekday === 6 };
}

/** First token that identifies a merchant, skipping filler words. */
const FILLER = new Set(["the", "a", "an", "of", "and", "at", "in", "on", "for", "to", "my", "from"]);
export function significantTokens(tokens: readonly string[]): string[] {
  return tokens.filter((t) => !FILLER.has(t) && t.length >= 2);
}

interface Budget {
  left: number;
  /** Raw count per group, for normalizing afterwards. */
  totals: Record<string, number>;
}

function addTo(map: Map<string, number>, key: string, budget: Budget): void {
  const current = map.get(key);
  if (current !== undefined) map.set(key, current + 1);
  else if (budget.left > 0) {
    map.set(key, 1);
    budget.left--;
  } else return;
  budget.totals[key[0]] = (budget.totals[key[0]] ?? 0) + 1;
}

/**
 * Words, bigrams, then char 3- to 5-grams (spaces act as word-boundary
 * markers), until `budget` distinct features exist. Iterates code points, so
 * emoji and astral CJK characters are never split.
 */
export function textFeatures(normalized: string, budget = MAX_FEATURES_PER_EXPENSE - CAT_GROUPS.length - 1): Map<string, number> {
  const raw = new Map<string, number>();
  if (!normalized) return raw;
  const left: Budget = { left: budget, totals: {} };
  const tokens = tokenize(normalized);
  for (const t of tokens) addTo(raw, `w:${t}`, left);
  for (let i = 0; i + 1 < tokens.length; i++) addTo(raw, `b:${tokens[i]} ${tokens[i + 1]}`, left);
  const padded = ` ${normalized} `;
  const cps = Array.from(padded);
  // Fast path: without astral characters, code points and UTF-16 units line up.
  const gram = cps.length === padded.length ? (i: number, n: number) => padded.substr(i, n) : (i: number, n: number) => cps.slice(i, i + n).join("");
  for (let n = 3; n <= 5 && left.left > 0; n++) {
    for (let i = 0; i + n <= cps.length; i++) addTo(raw, `c:${gram(i, n)}`, left);
  }
  // Normalize each group to total weight 1 (updating values in place is safe during forEach).
  raw.forEach((count, key) => raw.set(key, count / left.totals[key[0]]));
  return raw;
}

/** Merchant x amount-band conjunction: lets "amazon" at $14.99 differ from "amazon" at $60. */
export function merchantAmountFeature(tokens: readonly string[], amount: number | undefined): string | null {
  if (amount === undefined || !Number.isFinite(amount)) return null;
  const first = significantTokens(tokens)[0];
  return first ? `m:${first}|${amountBand(amount)}` : null;
}

export interface ContextInput {
  tokens: readonly string[];
  amount?: number;
  date: DateParts | null;
  recurring: boolean | null;
}

/** Categorical features; groups with no information (no amount, no date) are left out. */
export function contextFeatures(input: ContextInput): CatFeature[] {
  const out: CatFeature[] = [];
  const hits = matchLexicon(input.tokens);
  if (hits.length === 0) out.push({ group: 0, value: LEX_NONE, w: 1 });
  else for (const h of hits) out.push({ group: 0, value: CATEGORIES.indexOf(h.category), w: 1 / hits.length });
  if (input.amount !== undefined && Number.isFinite(input.amount) && input.amount >= 0) {
    out.push({ group: 1, value: amountBand(input.amount), w: 1 });
  }
  if (input.date) {
    out.push({ group: 2, value: domBand(input.date.dayOfMonth), w: 1 });
    out.push({ group: 3, value: input.date.weekend ? 1 : 0, w: 1 });
  }
  if (input.recurring !== null) out.push({ group: 4, value: input.recurring ? 1 : 0, w: 1 });
  return out;
}

export interface RecurrenceMatch {
  /** Category index of the matching earlier expense. */
  category: number;
  day: number;
}

/**
 * Remembers (day, amount, category) per normalized description to raise the
 * recurrence flag: same description, amount within 5%, 28 to 31 days earlier.
 */
export class RecurrenceIndex {
  private readonly byKey = new Map<string, { day: number; amount: number; category: number }[]>();
  private sorted = true;

  add(normalized: string, day: number, amount: number, category: number): void {
    if (!normalized || !Number.isFinite(amount)) return;
    let list = this.byKey.get(normalized);
    if (!list) this.byKey.set(normalized, (list = []));
    if (list.length && list[list.length - 1].day > day) this.sorted = false;
    list.push({ day, amount, category });
  }

  /** The most recent matching expense 28 to 31 days before `day`, if any. */
  find(normalized: string, day: number, amount: number | undefined): RecurrenceMatch | null {
    if (amount === undefined || !Number.isFinite(amount)) return null;
    const list = this.byKey.get(normalized);
    if (!list) return null;
    if (!this.sorted) {
      // Stable sort keeps insertion (label) order for same-day entries.
      this.byKey.forEach((l) => l.sort((a, b) => a.day - b.day));
      this.sorted = true;
    }
    // Binary search for the first entry at or after day - 31.
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].day < day - 31) lo = mid + 1;
      else hi = mid;
    }
    let match: RecurrenceMatch | null = null;
    for (let i = lo; i < list.length && list[i].day <= day - 28; i++) {
      const prev = list[i];
      if (Math.abs(amount - prev.amount) <= 0.05 * Math.abs(prev.amount)) match = { category: prev.category, day: prev.day };
    }
    return match;
  }

  isRecurring(normalized: string, day: number, amount: number | undefined): boolean {
    return this.find(normalized, day, amount) !== null;
  }
}
