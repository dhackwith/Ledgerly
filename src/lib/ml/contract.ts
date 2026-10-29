/**
 * Shared contract for smart category suggestions. The engine (index.ts), the
 * form UI, and the settings/feedback stores all build against these types, so
 * change them only with care: every side depends on them.
 */
import type { Category, Expense, SuggestionDisplay } from "@/lib/types";

/** localStorage keys. Deliberately not "expense-tracker:*", which makes other tabs reload expenses. */
export const ML_SETTINGS_KEY = "ledgerly:ml:settings:v1";
export const ML_FEEDBACK_KEY = "ledgerly:ml:feedback:v1";
export const ML_KEY_PREFIX = "ledgerly:ml:";

/** Calibrated confidence needed to pre-select a category for the user. */
export const PRESELECT_THRESHOLD = 0.85;
/** Calibrated confidence needed to show suggestion chips at all. */
export const CHIPS_THRESHOLD = 0.5;
/** In edit mode, only suggest a different category above this confidence. */
export const EDIT_DISAGREE_THRESHOLD = 0.9;

export interface SuggestionQuery {
  description: string;
  /** Parsed amount in dollars, if the amount field is valid. */
  amount?: number;
  /** YYYY-MM-DD, if the date field is valid. */
  date?: string;
  mode: "create" | "edit";
  /** In edit mode, the expense's saved category. */
  currentCategory?: Category;
}

export interface RankedCategory {
  category: Category;
  /** Calibrated probability, 0..1. */
  p: number;
}

export interface SuggestionResult {
  /** Up to 3 categories, most likely first. Empty when there is nothing worth showing. */
  ranked: RankedCategory[];
  /** Calibrated confidence of ranked[0], or 0. */
  confidence: number;
  /** What the form should do with this result. Decided by the engine from the thresholds above. */
  display: SuggestionDisplay;
  /** Short human-readable explanation, e.g. "You filed 'Uber' as Transportation 6 times". */
  reason: string | null;
  modelVersion: string;
}

export interface Suggester {
  suggest(query: SuggestionQuery): SuggestionResult;
}

export interface SuggesterOptions {
  /** ISO timestamp. Suggestion metadata on expenses saved before this is ignored ("Reset learning"). */
  ignoreSuggestionMetaBefore?: string | null;
  /** Override "now" for recency weighting (tests). */
  now?: Date;
}

export type CreateSuggester = (expenses: readonly Expense[], options?: SuggesterOptions) => Suggester;

export interface MlSettings {
  /** Smart suggestions on or off. */
  enabled: boolean;
  /** ISO timestamp of the last "Reset learning", or null. */
  resetAt: string | null;
}

/** One suggestion outcome, recorded on save. Contains no description text. */
export interface FeedbackEvent {
  /** ISO timestamp. */
  t: string;
  predicted: Category | null;
  confidence: number;
  final: Category;
  shown: SuggestionDisplay;
  modelVersion: string;
}

export function noSuggestion(modelVersion: string): SuggestionResult {
  return { ranked: [], confidence: 0, display: "none", reason: null, modelVersion };
}
