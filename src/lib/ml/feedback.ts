// On-device log of suggestion outcomes, used only for the accuracy panel in Settings (plan 2.4).
// A capped ring buffer with no description text. The original exports keep their signatures; see contract.ts.
import { CATEGORIES, type Category, type SuggestionDisplay } from "@/lib/types";
import { ML_FEEDBACK_KEY, type FeedbackEvent } from "./contract";

export const MAX_FEEDBACK_EVENTS = 500;

const DISPLAYS: readonly SuggestionDisplay[] = ["preselected", "chips", "none"];
const MAX_VERSION_LENGTH = 40;

const listeners = new Set<() => void>();

/** Called after this tab records or clears feedback (other tabs: listen for the storage event). Returns an unsubscribe function. */
export function subscribeFeedback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Rebuilds an event from known fields only, so unknown fields (and any text riding along
 * with them) are never stored. Returns null when a field is missing or invalid.
 */
export function sanitizeFeedbackEvent(raw: unknown): FeedbackEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.t !== "string" || r.t.length > 40 || Number.isNaN(Date.parse(r.t))) return null;
  if (r.predicted !== null && !isCategory(r.predicted)) return null;
  if (!isCategory(r.final)) return null;
  if (!DISPLAYS.includes(r.shown as SuggestionDisplay)) return null;
  // Nothing can be on screen without a prediction.
  if (r.predicted === null && r.shown !== "none") return null;
  if (typeof r.confidence !== "number" || !Number.isFinite(r.confidence)) return null;
  if (typeof r.modelVersion !== "string" || r.modelVersion.length === 0 || r.modelVersion.length > MAX_VERSION_LENGTH) return null;
  return {
    t: r.t,
    predicted: r.predicted as Category | null,
    confidence: Math.min(1, Math.max(0, r.confidence)),
    final: r.final,
    shown: r.shown as SuggestionDisplay,
    modelVersion: r.modelVersion,
  };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Most recent events first. Never throws. */
export function readFeedback(): FeedbackEvent[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(ML_FEEDBACK_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("feedback log is not an array");
    const events: FeedbackEvent[] = [];
    for (const item of parsed) {
      const event = sanitizeFeedbackEvent(item);
      if (event) events.push(event);
      if (events.length === MAX_FEEDBACK_EVENTS) break;
    }
    return events;
  } catch {
    clearFeedback(); // corrupt log: discard it and start over
    return [];
  }
}

/** Records one suggestion outcome. Never throws. */
export function recordFeedback(event: FeedbackEvent): void {
  const clean = sanitizeFeedbackEvent(event);
  const store = storage();
  if (!clean || !store) return;
  try {
    const events = [clean, ...readFeedback()].slice(0, MAX_FEEDBACK_EVENTS);
    store.setItem(ML_FEEDBACK_KEY, JSON.stringify(events));
  } catch {
    return; // quota or blocked storage: metrics are optional, skip silently
  }
  listeners.forEach((l) => l());
}

export function clearFeedback(): void {
  try {
    storage()?.removeItem(ML_FEEDBACK_KEY);
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}

export interface AcceptanceStats {
  /** Suggestions shown this way. */
  shown: number;
  /** Of those, how many were saved with the suggested category. */
  accepted: number;
  /** accepted / shown, or null when nothing was shown. */
  rate: number | null;
}

export interface FeedbackSummary extends AcceptanceStats {
  preselected: AcceptanceStats;
  chips: AcceptanceStats;
}

function stats(shown: number, accepted: number): AcceptanceStats {
  return { shown, accepted, rate: shown === 0 ? null : accepted / shown };
}

/**
 * Acceptance over the most recent `limit` suggestions that were actually shown (pre-selected or
 * chips). Events where nothing was shown are skipped and don't count toward the limit.
 * `events` must be most recent first, as readFeedback() returns them.
 */
export function summarizeFeedback(events: readonly FeedbackEvent[], limit = 100): FeedbackSummary {
  const max = Number.isNaN(limit) ? 0 : Math.max(0, Math.floor(limit));
  const counts = { preselected: { shown: 0, accepted: 0 }, chips: { shown: 0, accepted: 0 } };
  let seen = 0;
  for (const e of events) {
    if (seen >= max) break;
    if (e.shown === "none") continue;
    seen++;
    counts[e.shown].shown++;
    if (e.final === e.predicted) counts[e.shown].accepted++;
  }
  const { preselected: p, chips: c } = counts;
  return {
    ...stats(p.shown + c.shown, p.accepted + c.accepted),
    preselected: stats(p.shown, p.accepted),
    chips: stats(c.shown, c.accepted),
  };
}
