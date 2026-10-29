// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ML_FEEDBACK_KEY, ML_SETTINGS_KEY } from "../contract";

// Node 26 has its own localStorage (unusable without --localstorage-file) that shadows jsdom's. Use jsdom's.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window & typeof globalThis } }).jsdom.window;
Object.defineProperty(globalThis, "localStorage", { value: jsdomWindow.localStorage, configurable: true, writable: true });
const storageProto = Object.getPrototypeOf(jsdomWindow.localStorage) as Storage;

type SettingsModule = typeof import("../settings");

// A fresh module per test, so the lazily loaded in-memory value starts empty.
async function load(): Promise<SettingsModule> {
  vi.resetModules();
  return import("../settings");
}

function storageEvent(key: string | null, newValue: string | null) {
  window.dispatchEvent(new jsdomWindow.StorageEvent("storage", { key, newValue }));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ml settings: defaults and persistence", () => {
  it("starts with suggestions off and no reset", async () => {
    const m = await load();
    expect(m.DEFAULT_ML_SETTINGS).toEqual({ enabled: false, resetAt: null });
    expect(m.getMlSettings()).toBe(m.DEFAULT_ML_SETTINGS);
  });

  it("doesn't read storage until first access", async () => {
    const getItem = vi.spyOn(storageProto, "getItem");
    const m = await load();
    expect(getItem).not.toHaveBeenCalled();
    m.getMlSettings();
    expect(getItem).toHaveBeenCalledWith(ML_SETTINGS_KEY);
  });

  it("persists changes and reads them back in a new session", async () => {
    const m = await load();
    m.setMlSettings({ enabled: true });
    expect(JSON.parse(localStorage.getItem(ML_SETTINGS_KEY)!)).toEqual({ enabled: true, resetAt: null });

    const again = await load();
    expect(again.getMlSettings()).toEqual({ enabled: true, resetAt: null });
  });

  it("merges partial patches and ignores invalid fields", async () => {
    const m = await load();
    m.setMlSettings({ enabled: true });
    m.setMlSettings({ resetAt: "2026-10-01T12:00:00.000Z" });
    expect(m.getMlSettings()).toEqual({ enabled: true, resetAt: "2026-10-01T12:00:00.000Z" });

    m.setMlSettings({ enabled: "yes" as unknown as boolean, resetAt: "not a date" });
    expect(m.getMlSettings()).toEqual({ enabled: true, resetAt: "2026-10-01T12:00:00.000Z" });

    m.setMlSettings({ resetAt: null });
    expect(m.getMlSettings().resetAt).toBeNull();
  });

  it("falls back to defaults for corrupt or malformed JSON", async () => {
    for (const raw of ["{not json", "null", "[1,2]", '"text"', "42"]) {
      localStorage.setItem(ML_SETTINGS_KEY, raw);
      const m = await load();
      expect(m.getMlSettings()).toEqual(m.DEFAULT_ML_SETTINGS);
    }
  });

  it("keeps the valid fields of a partly valid record", async () => {
    localStorage.setItem(ML_SETTINGS_KEY, JSON.stringify({ enabled: true, resetAt: 12, extra: "x" }));
    const m = await load();
    expect(m.getMlSettings()).toEqual({ enabled: true, resetAt: null });
  });

  it("uses defaults when storage can't be read", async () => {
    vi.spyOn(storageProto, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const m = await load();
    expect(m.getMlSettings()).toEqual(m.DEFAULT_ML_SETTINGS);
  });

  it("keeps the in-memory value when writing fails", async () => {
    vi.spyOn(storageProto, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const m = await load();
    const listener = vi.fn();
    m.subscribeMlSettings(listener);
    expect(() => m.setMlSettings({ enabled: true })).not.toThrow();
    expect(m.getMlSettings().enabled).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("ml settings: subscription", () => {
  it("returns the same reference until settings change", async () => {
    const m = await load();
    const first = m.getMlSettings();
    expect(m.getMlSettings()).toBe(first);

    m.setMlSettings({ enabled: false }); // no change
    expect(m.getMlSettings()).toBe(first);

    m.setMlSettings({ enabled: true });
    const second = m.getMlSettings();
    expect(second).not.toBe(first);
    expect(m.getMlSettings()).toBe(second);
  });

  it("notifies subscribers on change only, and stops after unsubscribe", async () => {
    const m = await load();
    const listener = vi.fn();
    const unsubscribe = m.subscribeMlSettings(listener);

    m.setMlSettings({ enabled: true });
    expect(listener).toHaveBeenCalledTimes(1);
    m.setMlSettings({ enabled: true });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    m.setMlSettings({ enabled: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("picks up changes from other tabs for its own key only", async () => {
    const m = await load();
    const listener = vi.fn();
    m.subscribeMlSettings(listener);

    storageEvent("expense-tracker:expenses:v1", "[]");
    storageEvent(ML_FEEDBACK_KEY, "[]");
    expect(listener).not.toHaveBeenCalled();

    storageEvent(ML_SETTINGS_KEY, JSON.stringify({ enabled: true, resetAt: null }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(m.getMlSettings().enabled).toBe(true);

    storageEvent(ML_SETTINGS_KEY, "{corrupt");
    expect(m.getMlSettings()).toEqual(m.DEFAULT_ML_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("resets to defaults when another tab clears storage", async () => {
    const m = await load();
    m.setMlSettings({ enabled: true });
    storageEvent(null, null);
    expect(m.getMlSettings()).toEqual(m.DEFAULT_ML_SETTINGS);
  });
});

describe("ml settings: reset and clear", () => {
  it("resetLearning clears the feedback log, records the time and keeps expenses", async () => {
    localStorage.setItem(ML_FEEDBACK_KEY, "[]");
    localStorage.setItem("expense-tracker:expenses:v1", "[]");
    const m = await load();
    m.setMlSettings({ enabled: true });

    m.resetLearning(new Date("2026-10-28T09:30:00.000Z"));
    expect(localStorage.getItem(ML_FEEDBACK_KEY)).toBeNull();
    expect(localStorage.getItem("expense-tracker:expenses:v1")).toBe("[]");
    expect(m.getMlSettings()).toEqual({ enabled: true, resetAt: "2026-10-28T09:30:00.000Z" });
  });

  it("clearMlStorage removes every ML key, keeps others and resets settings", async () => {
    localStorage.setItem(ML_FEEDBACK_KEY, "[]");
    localStorage.setItem("ledgerly:ml:future-model:v2", "{}");
    localStorage.setItem("expense-tracker:expenses:v1", "[]");
    localStorage.setItem("ledgerly:cloud:v1", "{}");
    const m = await load();
    m.setMlSettings({ enabled: true });
    const listener = vi.fn();
    m.subscribeMlSettings(listener);

    m.clearMlStorage();
    expect(Object.keys(localStorage).sort()).toEqual(["expense-tracker:expenses:v1", "ledgerly:cloud:v1"]);
    expect(m.getMlSettings()).toBe(m.DEFAULT_ML_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clearMlStorage never throws when storage is blocked", async () => {
    localStorage.setItem(ML_SETTINGS_KEY, "{}");
    vi.spyOn(storageProto, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const m = await load();
    expect(() => m.clearMlStorage()).not.toThrow();
  });
});

describe("ml settings: server rendering", () => {
  it("works without window and always returns defaults", async () => {
    vi.stubGlobal("window", undefined);
    const m = await load();
    expect(m.getMlSettings()).toBe(m.DEFAULT_ML_SETTINGS);
    expect(m.getServerMlSettings()).toBe(m.DEFAULT_ML_SETTINGS);

    const unsubscribe = m.subscribeMlSettings(() => {});
    expect(() => m.setMlSettings({ enabled: true })).not.toThrow();
    expect(() => m.resetLearning()).not.toThrow();
    expect(() => m.clearMlStorage()).not.toThrow();
    expect(m.getMlSettings()).toBe(m.DEFAULT_ML_SETTINGS);
    unsubscribe();
  });
});
