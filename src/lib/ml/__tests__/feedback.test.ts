// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ML_FEEDBACK_KEY, type FeedbackEvent } from "../contract";
import { MAX_FEEDBACK_EVENTS, clearFeedback, readFeedback, recordFeedback, sanitizeFeedbackEvent, summarizeFeedback } from "../feedback";

// Node 26 has its own localStorage (unusable without --localstorage-file) that shadows jsdom's. Use jsdom's.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
Object.defineProperty(globalThis, "localStorage", { value: jsdomWindow.localStorage, configurable: true, writable: true });
const storageProto = Object.getPrototypeOf(jsdomWindow.localStorage) as Storage;

function event(overrides: Partial<FeedbackEvent> = {}): FeedbackEvent {
  return {
    t: "2026-10-28T10:00:00.000Z",
    predicted: "Food",
    confidence: 0.9,
    final: "Food",
    shown: "preselected",
    modelVersion: "1",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("feedback log", () => {
  it("records and reads events, most recent first", () => {
    recordFeedback(event({ t: "2026-10-01T00:00:00.000Z", final: "Bills" }));
    recordFeedback(event({ t: "2026-10-02T00:00:00.000Z", final: "Other" }));
    const events = readFeedback();
    expect(events.map((e) => e.final)).toEqual(["Other", "Bills"]);
    expect(events[0]).toEqual(event({ t: "2026-10-02T00:00:00.000Z", final: "Other" }));
  });

  it("keeps only the last 500 events", () => {
    for (let i = 0; i < MAX_FEEDBACK_EVENTS + 10; i++) recordFeedback(event({ modelVersion: `v${i}` }));
    const events = readFeedback();
    expect(MAX_FEEDBACK_EVENTS).toBe(500);
    expect(events).toHaveLength(500);
    expect(events[0].modelVersion).toBe("v509");
    expect(events[499].modelVersion).toBe("v10");
    expect(JSON.parse(localStorage.getItem(ML_FEEDBACK_KEY)!)).toHaveLength(500);
  });

  it("caps an oversized log written elsewhere", () => {
    localStorage.setItem(ML_FEEDBACK_KEY, JSON.stringify(Array.from({ length: 700 }, () => event())));
    expect(readFeedback()).toHaveLength(500);
  });

  it("stores only contract fields, never description text", () => {
    const leaky = { ...event(), description: "Dinner at Luigi's", note: "secret", amount: 42 } as FeedbackEvent;
    recordFeedback(leaky);
    const raw = localStorage.getItem(ML_FEEDBACK_KEY)!;
    expect(raw).not.toContain("Luigi");
    expect(raw).not.toContain("description");
    expect(raw).not.toContain("secret");
    expect(Object.keys(readFeedback()[0]).sort()).toEqual(["confidence", "final", "modelVersion", "predicted", "shown", "t"]);
  });

  it("rejects invalid events", () => {
    const bad: unknown[] = [
      null,
      "text",
      [],
      event({ final: "Groceries" as FeedbackEvent["final"] }),
      event({ predicted: "Nope" as FeedbackEvent["predicted"] }),
      event({ shown: "popup" as FeedbackEvent["shown"] }),
      event({ predicted: null, shown: "chips" }),
      event({ confidence: Number.NaN }),
      event({ confidence: "0.9" as unknown as number }),
      event({ t: "yesterday" }),
      event({ modelVersion: "" }),
      event({ modelVersion: "x".repeat(200) }),
      { ...event(), final: undefined },
    ];
    for (const b of bad) {
      expect(sanitizeFeedbackEvent(b)).toBeNull();
      recordFeedback(b as FeedbackEvent);
    }
    expect(localStorage.getItem(ML_FEEDBACK_KEY)).toBeNull();
  });

  it("accepts a null prediction when nothing was shown, and clamps confidence", () => {
    expect(sanitizeFeedbackEvent(event({ predicted: null, shown: "none", confidence: 0 }))).not.toBeNull();
    expect(sanitizeFeedbackEvent(event({ confidence: 1.0000001 }))?.confidence).toBe(1);
    expect(sanitizeFeedbackEvent(event({ confidence: -0.2 }))?.confidence).toBe(0);
  });

  it("drops invalid entries from a stored log", () => {
    localStorage.setItem(ML_FEEDBACK_KEY, JSON.stringify([event(), { junk: true }, 7, event({ final: "Bills" })]));
    expect(readFeedback().map((e) => e.final)).toEqual(["Food", "Bills"]);
  });

  it("resets a corrupt log", () => {
    for (const raw of ["{oops", '{"a":1}', "null", '"text"']) {
      localStorage.setItem(ML_FEEDBACK_KEY, raw);
      expect(readFeedback()).toEqual([]);
      expect(localStorage.getItem(ML_FEEDBACK_KEY)).toBeNull();
    }
    localStorage.setItem(ML_FEEDBACK_KEY, "{oops");
    recordFeedback(event());
    expect(readFeedback()).toHaveLength(1);
  });

  it("never throws when storage fails", () => {
    recordFeedback(event());
    vi.spyOn(storageProto, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(storageProto, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(storageProto, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => recordFeedback(event())).not.toThrow();
    expect(readFeedback()).toEqual([]);
    expect(() => clearFeedback()).not.toThrow();
  });

  it("clears the log", () => {
    recordFeedback(event());
    clearFeedback();
    expect(localStorage.getItem(ML_FEEDBACK_KEY)).toBeNull();
    expect(readFeedback()).toEqual([]);
  });

  it("is a no-op without window (server rendering)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => recordFeedback(event())).not.toThrow();
    expect(readFeedback()).toEqual([]);
    expect(() => clearFeedback()).not.toThrow();
  });
});

describe("summarizeFeedback", () => {
  it("reports no rate when nothing was shown", () => {
    const s = summarizeFeedback([event({ shown: "none" }), event({ predicted: null, shown: "none" })]);
    expect(s).toEqual({
      shown: 0,
      accepted: 0,
      rate: null,
      preselected: { shown: 0, accepted: 0, rate: null },
      chips: { shown: 0, accepted: 0, rate: null },
    });
    expect(summarizeFeedback([]).rate).toBeNull();
  });

  it("computes overall and split acceptance among shown suggestions", () => {
    const events = [
      event({ shown: "preselected" }),
      event({ shown: "preselected", final: "Bills" }),
      event({ shown: "preselected" }),
      event({ shown: "preselected" }),
      event({ shown: "chips", predicted: "Shopping", final: "Shopping" }),
      event({ shown: "chips", predicted: "Shopping", final: "Other" }),
      event({ shown: "none", predicted: "Food", final: "Food" }),
    ];
    const s = summarizeFeedback(events);
    expect(s.shown).toBe(6);
    expect(s.accepted).toBe(4);
    expect(s.rate).toBeCloseTo(4 / 6);
    expect(s.preselected).toEqual({ shown: 4, accepted: 3, rate: 0.75 });
    expect(s.chips).toEqual({ shown: 2, accepted: 1, rate: 0.5 });
  });

  it("counts only the most recent `limit` shown suggestions", () => {
    const events = [
      event({ shown: "none" }),
      event({ final: "Bills" }),
      event({ shown: "none" }),
      event(),
      event(), // beyond a limit of 2
      event({ final: "Other" }),
    ];
    const s = summarizeFeedback(events, 2);
    expect(s.shown).toBe(2);
    expect(s.accepted).toBe(1);
    expect(s.rate).toBe(0.5);
    expect(summarizeFeedback(events, 0).shown).toBe(0);
    expect(summarizeFeedback(events, -5).shown).toBe(0);
  });

  it("defaults to the last 100 suggestions", () => {
    const events = [...Array.from({ length: 100 }, () => event()), ...Array.from({ length: 50 }, () => event({ final: "Bills" }))];
    const s = summarizeFeedback(events);
    expect(s.shown).toBe(100);
    expect(s.rate).toBe(1);
  });
});
