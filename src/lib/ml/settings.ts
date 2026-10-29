// Smart-suggestion settings, persisted in localStorage and shared with React through
// useSyncExternalStore. The original exports keep their signatures; see contract.ts.
import { ML_KEY_PREFIX, ML_SETTINGS_KEY, type MlSettings } from "./contract";
import { clearFeedback } from "./feedback";

/** Off while the feature is in development (plan 7.1). Flip `enabled` to ship it on by default. */
export const DEFAULT_ML_SETTINGS: MlSettings = Object.freeze({ enabled: false, resetAt: null });

// Loaded lazily on first client access, so importing this module never touches `window`.
let current: MlSettings | null = null;
let listening = false;
const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

/** Keeps the valid fields of `raw` and takes the rest from `base`. */
function sanitize(raw: unknown, base: MlSettings): MlSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : base.enabled,
    resetAt: r.resetAt === null || isTimestamp(r.resetAt) ? (r.resetAt as string | null) : base.resetAt,
  };
}

function parse(raw: string | null): MlSettings {
  if (raw === null) return DEFAULT_ML_SETTINGS;
  try {
    return sanitize(JSON.parse(raw), DEFAULT_ML_SETTINGS);
  } catch {
    return DEFAULT_ML_SETTINGS; // corrupt JSON: defaults, silently
  }
}

function load(): MlSettings {
  try {
    return parse(window.localStorage.getItem(ML_SETTINGS_KEY));
  } catch {
    return DEFAULT_ML_SETTINGS; // storage blocked
  }
}

/** Swaps in `next` and notifies subscribers. Keeps the old reference when nothing changed. */
function commit(next: MlSettings): boolean {
  if (current && current.enabled === next.enabled && current.resetAt === next.resetAt) return false;
  current = next;
  listeners.forEach((l) => l());
  return true;
}

// Another tab wrote the settings, or cleared storage (reported as key null).
function onStorage(e: StorageEvent) {
  if (e.key !== ML_SETTINGS_KEY && e.key !== null) return;
  commit(parse(e.key === null ? null : e.newValue));
}

function ensureLoaded(): MlSettings {
  if (current === null) current = load();
  if (!listening) {
    listening = true;
    window.addEventListener("storage", onStorage);
  }
  return current;
}

/** Current settings. Safe to call during server rendering (returns defaults). */
export function getMlSettings(): MlSettings {
  if (!isBrowser()) return DEFAULT_ML_SETTINGS;
  return ensureLoaded();
}

/** getServerSnapshot for useSyncExternalStore: always the defaults, so hydration matches the server render. */
export function getServerMlSettings(): MlSettings {
  return DEFAULT_ML_SETTINGS;
}

/** Merges `patch` into the settings; invalid fields are ignored. Never throws. No-op on the server. */
export function setMlSettings(patch: Partial<MlSettings>): void {
  if (!isBrowser()) return;
  const next = sanitize(patch, ensureLoaded());
  if (!commit(next)) return;
  try {
    window.localStorage.setItem(ML_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* quota or blocked storage: keep the in-memory value for this session */
  }
}

/** For useSyncExternalStore. Returns an unsubscribe function. */
export function subscribeMlSettings(listener: () => void): () => void {
  if (isBrowser()) ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * "Reset learning": clears the feedback log and records the time, so the engine ignores
 * suggestion metadata saved before it. Expenses and their categories are never touched.
 */
export function resetLearning(now: Date = new Date()): void {
  clearFeedback();
  setMlSettings({ resetAt: now.toISOString() });
}

/** Part of "clear all data": removes every "ledgerly:ml:*" key and returns settings to the defaults. Never throws. */
export function clearMlStorage(): void {
  if (!isBrowser()) return;
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(ML_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    /* storage blocked: nothing we can remove */
  }
  ensureLoaded();
  commit(DEFAULT_ML_SETTINGS);
}
