// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/types";
import type { MlSettings } from "@/lib/ml/contract";
import {
  SUGGEST_DEBOUNCE_MS,
  useCategorySuggestions,
  type CategorySuggestionInput,
} from "../useCategorySuggestions";
import { expense, suggestion } from "./fixtures";

const h = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    suggest: vi.fn(),
    createSuggester: vi.fn(),
    expenses: [] as Expense[],
    settings: { enabled: true, resetAt: null } as MlSettings,
    listeners,
    setSettings(next: MlSettings) {
      this.settings = next;
      listeners.forEach((l) => l());
    },
  };
});

vi.mock("@/lib/ml", () => ({
  MODEL_VERSION: "test-1",
  createSuggester: (...args: unknown[]) => h.createSuggester(...args),
}));
vi.mock("@/lib/ml/settings", () => ({
  DEFAULT_ML_SETTINGS: { enabled: false, resetAt: null },
  getMlSettings: () => h.settings,
  subscribeMlSettings: (l: () => void) => {
    h.listeners.add(l);
    return () => h.listeners.delete(l);
  },
}));
vi.mock("@/components/providers/ExpenseProvider", () => ({
  useExpenses: () => ({ expenses: h.expenses }),
}));

const base: CategorySuggestionInput = { description: "", amount: "", date: "2026-10-01", mode: "create" };

function setup(input: Partial<CategorySuggestionInput> = {}) {
  return renderHook((props: CategorySuggestionInput) => useCategorySuggestions(props), {
    initialProps: { ...base, ...input },
  });
}

const flush = () => act(() => vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-28T12:00:00"));
  h.expenses = [];
  h.settings = { enabled: true, resetAt: null };
  h.listeners.clear();
  h.suggest.mockReset().mockReturnValue(suggestion("chips", [["Transportation", 0.7]]));
  h.createSuggester.mockReset().mockImplementation(() => ({ suggest: h.suggest }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useCategorySuggestions", () => {
  it("returns no suggestion until the debounce has passed", () => {
    const { result } = setup({ description: "uber" });
    expect(result.current.result).toBeNull();
    act(() => vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS - 1));
    expect(h.suggest).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.result?.ranked[0].category).toBe("Transportation");
    expect(result.current.enabled).toBe(true);
  });

  it("calls the engine once per pause in typing, with the latest text", () => {
    const { rerender } = setup({ description: "ub" });
    for (const description of ["ube", "uber", "uber t"]) {
      act(() => vi.advanceTimersByTime(50));
      rerender({ ...base, description });
    }
    flush();
    expect(h.suggest).toHaveBeenCalledTimes(1);
    expect(h.suggest).toHaveBeenCalledWith(expect.objectContaining({ description: "uber t" }));
  });

  it("does nothing for descriptions shorter than 2 characters after trimming", () => {
    const { result } = setup({ description: " u  " });
    flush();
    act(() => vi.advanceTimersByTime(1000));
    expect(h.suggest).not.toHaveBeenCalled();
    expect(result.current.result).toBeNull();
  });

  it("clears the result when the description becomes too short", () => {
    const { result, rerender } = setup({ description: "uber" });
    flush();
    expect(result.current.result).not.toBeNull();
    rerender({ ...base, description: "u" });
    expect(result.current.result).toBeNull();
  });

  it("passes the trimmed text, valid amount and date, mode and current category", () => {
    setup({ description: "  uber ", amount: "$1,234.5", date: "2026-10-01", mode: "edit", currentCategory: "Food" });
    flush();
    expect(h.suggest).toHaveBeenCalledWith({
      description: "uber",
      amount: 1234.5,
      date: "2026-10-01",
      mode: "edit",
      currentCategory: "Food",
    });
  });

  it("leaves out an invalid amount and date", () => {
    setup({ description: "uber", amount: "12.345", date: "2026-13-45" });
    flush();
    expect(h.suggest).toHaveBeenCalledWith({ description: "uber", mode: "create" });
  });

  it("leaves out a zero amount and a future date", () => {
    setup({ description: "uber", amount: "0", date: "2027-01-01" });
    flush();
    expect(h.suggest).toHaveBeenCalledWith({ description: "uber", mode: "create" });
  });

  it("builds the suggester from the expenses and the reset time, and rebuilds when expenses change", () => {
    h.expenses = [expense()];
    h.settings = { enabled: true, resetAt: "2026-10-20T00:00:00.000Z" };
    const { rerender } = setup({ description: "uber" });
    expect(h.createSuggester).toHaveBeenCalledTimes(1);
    expect(h.createSuggester).toHaveBeenCalledWith(h.expenses, { ignoreSuggestionMetaBefore: "2026-10-20T00:00:00.000Z" });

    rerender({ ...base, description: "uber x" });
    expect(h.createSuggester).toHaveBeenCalledTimes(1);

    h.expenses = [expense(), expense({ id: "e2" })];
    rerender({ ...base, description: "uber x" });
    expect(h.createSuggester).toHaveBeenCalledTimes(2);
  });

  it("does nothing when suggestions are turned off", () => {
    h.settings = { enabled: false, resetAt: null };
    const { result } = setup({ description: "uber" });
    flush();
    expect(h.createSuggester).not.toHaveBeenCalled();
    expect(h.suggest).not.toHaveBeenCalled();
    expect(result.current).toEqual({ result: null, enabled: false });
  });

  it("drops the suggestion as soon as suggestions are turned off", () => {
    const { result } = setup({ description: "uber" });
    flush();
    expect(result.current.result).not.toBeNull();
    act(() => h.setSettings({ enabled: false, resetAt: null }));
    expect(result.current).toEqual({ result: null, enabled: false });
  });

  it("treats a throwing engine as no suggestion and logs only once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    h.suggest.mockImplementation(() => {
      throw new Error("boom");
    });
    const { result, rerender } = setup({ description: "uber" });
    flush();
    rerender({ ...base, description: "uber eats" });
    flush();
    expect(h.suggest).toHaveBeenCalledTimes(2);
    expect(result.current.result).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("treats a failing createSuggester as no suggestion and logs only once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    h.createSuggester.mockImplementation(() => {
      throw new Error("bad data");
    });
    const { result, rerender } = setup({ description: "uber" });
    rerender({ ...base, description: "uber eats" });
    flush();
    expect(result.current.result).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("treats a malformed result as no suggestion", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.suggest.mockReturnValue(undefined);
    const { result } = setup({ description: "uber" });
    flush();
    expect(result.current.result).toBeNull();
  });

  it("keeps only known categories, at most three", () => {
    h.suggest.mockReturnValue(
      suggestion("chips", [
        ["Food", 0.4],
        ["Groceries" as never, 0.3],
        ["Shopping", 0.1],
        ["Bills", 0.1],
        ["Other", 0.1],
      ]),
    );
    const { result } = setup({ description: "uber" });
    flush();
    expect(result.current.result?.ranked.map((r) => r.category)).toEqual(["Food", "Shopping", "Bills"]);
    expect(result.current.result?.display).toBe("chips");
  });

  it("shows nothing when no ranked category survives", () => {
    h.suggest.mockReturnValue(suggestion("preselected", [["Groceries" as never, 0.95]]));
    const { result } = setup({ description: "uber" });
    flush();
    expect(result.current.result?.display).toBe("none");
    expect(result.current.result?.ranked).toEqual([]);
  });

  it("trains on every expense when nothing is excluded", () => {
    h.expenses = [expense({ id: "a" }), expense({ id: "b" })];
    setup({ description: "uber" });
    expect(h.createSuggester).toHaveBeenCalledWith(h.expenses, expect.anything());
  });

  it("leaves the excluded expense out of training", () => {
    h.expenses = [expense({ id: "a" }), expense({ id: "b" })];
    setup({ description: "uber", mode: "edit", currentCategory: "Food", excludeId: "a" });
    const training = h.createSuggester.mock.calls.at(-1)![0] as Expense[];
    expect(training.map((e) => e.id)).toEqual(["b"]);
  });

  it("renders as disabled on the server, so hydration matches", () => {
    function Probe() {
      const { result, enabled } = useCategorySuggestions({ ...base, description: "uber" });
      return <span>{`${enabled}:${result === null}`}</span>;
    }
    expect(renderToString(<Probe />)).toContain("false:true");
    expect(h.createSuggester).not.toHaveBeenCalled();
  });
});
