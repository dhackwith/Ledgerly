// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadExpenses, saveExpenses } from "../storage";
import { FULL_META, SUGGESTION, expense } from "./metaFixtures";
import { installLocalStorage } from "./localStorage";

installLocalStorage();

const KEY = "expense-tracker:expenses:v1";
const store = (list: unknown[]) => window.localStorage.setItem(KEY, JSON.stringify(list));

describe("expense storage meta", () => {
  beforeEach(() => window.localStorage.clear());

  it("loads legacy records without meta unchanged", () => {
    const legacy = expense();
    store([legacy]);
    const [loaded] = loadExpenses();
    expect(loaded).toEqual(legacy);
    expect("meta" in loaded).toBe(false);
  });

  it("round-trips full meta", () => {
    const list = [expense({ meta: FULL_META }), expense({ id: "e2", meta: { source: "sample" } }), expense({ id: "e3" })];
    saveExpenses(list);
    expect(loadExpenses()).toEqual(list);
  });

  it("drops malformed meta but keeps the expense", () => {
    store([expense({ id: "a" }), { ...expense({ id: "b" }), meta: { source: "hacked" } }, { ...expense({ id: "c" }), meta: "manual" }, { ...expense({ id: "d" }), meta: null }]);
    const loaded = loadExpenses();
    expect(loaded.map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    for (const e of loaded) expect(e.meta).toBeUndefined();
  });

  it("drops a malformed suggestion but keeps the source", () => {
    store([{ ...expense(), meta: { source: "sample", suggestion: { ...SUGGESTION, confidence: 2 } } }]);
    expect(loadExpenses()[0].meta).toEqual({ source: "sample" });
  });

  it("strips unknown meta fields", () => {
    store([{ ...expense(), meta: { ...FULL_META, injected: true, suggestion: { ...SUGGESTION, html: "<b>" } } }]);
    expect(loadExpenses()[0].meta).toEqual(FULL_META);
  });

  it("still drops invalid expenses", () => {
    store([{ ...expense(), category: "Travel", meta: FULL_META }, expense({ id: "ok" })]);
    expect(loadExpenses().map((e) => e.id)).toEqual(["ok"]);
  });
});
