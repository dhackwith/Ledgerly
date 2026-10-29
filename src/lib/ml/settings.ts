// PLACEHOLDER: owned by the ml-settings feature, which replaces this with a persisted store.
// The signatures must stay as they are; see contract.ts.
import type { MlSettings } from "./contract";

export const DEFAULT_ML_SETTINGS: MlSettings = { enabled: false, resetAt: null };

let current: MlSettings = DEFAULT_ML_SETTINGS;
const listeners = new Set<() => void>();

/** Current settings. Safe to call during server rendering (returns defaults). */
export function getMlSettings(): MlSettings {
  return current;
}

export function setMlSettings(patch: Partial<MlSettings>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. Returns an unsubscribe function. */
export function subscribeMlSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
