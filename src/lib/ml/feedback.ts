// PLACEHOLDER: owned by the ml-settings feature, which replaces this with a capped localStorage log.
// The signatures must stay as they are; see contract.ts.
import type { FeedbackEvent } from "./contract";

/** Records one suggestion outcome. Never throws. */
export function recordFeedback(_event: FeedbackEvent): void {}

/** Most recent events first. Never throws. */
export function readFeedback(): FeedbackEvent[] {
  return [];
}

export function clearFeedback(): void {}
