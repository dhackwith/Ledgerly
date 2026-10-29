// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadExpenses } from "@/lib/storage";
import { FULL_META, SUGGESTION, expense } from "@/lib/__tests__/metaFixtures";
import { installLocalStorage } from "@/lib/__tests__/localStorage";
import { ExpenseProvider, useExpenses } from "../ExpenseProvider";
import { ToastProvider } from "../ToastProvider";

installLocalStorage();

const KEY = "expense-tracker:expenses:v1";
const input = { date: "2026-10-03", amount: 9.5, category: "Food" as const, description: "Coffee and cake" };

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    <ExpenseProvider>{children}</ExpenseProvider>
  </ToastProvider>
);

async function setup() {
  const hook = renderHook(() => useExpenses(), { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

describe("ExpenseProvider meta", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("defaults addExpense to source manual", async () => {
    const { result } = await setup();
    let added: ReturnType<typeof result.current.addExpense> | undefined;
    act(() => {
      added = result.current.addExpense(input);
    });
    expect(added?.meta).toEqual({ source: "manual" });
    expect(result.current.expenses[0].meta).toEqual({ source: "manual" });
  });

  it("stores the meta given to addExpense and persists it", async () => {
    const { result } = await setup();
    act(() => {
      result.current.addExpense(input, { source: "manual", suggestion: SUGGESTION });
    });
    expect(result.current.expenses[0].meta).toEqual({ source: "manual", suggestion: SUGGESTION });
    await waitFor(() => expect(loadExpenses()[0]?.meta).toEqual({ source: "manual", suggestion: SUGGESTION }));
  });

  it("applies addMany meta to every new expense", async () => {
    const { result } = await setup();
    act(() => result.current.addMany([input, { ...input, description: "Tea" }], { source: "sample" }));
    expect(result.current.expenses).toHaveLength(2);
    for (const e of result.current.expenses) expect(e.meta).toEqual({ source: "sample" });
    expect(result.current.expenses[0].meta).not.toBe(result.current.expenses[1].meta);
  });

  it("defaults addMany to source manual", async () => {
    const { result } = await setup();
    act(() => result.current.addMany([input]));
    expect(result.current.expenses[0].meta).toEqual({ source: "manual" });
  });

  it("sets recategorizedAt only when an edit changes the category", async () => {
    const { result } = await setup();
    let id = "";
    act(() => {
      id = result.current.addExpense(input, { source: "import" }).id;
    });
    act(() => result.current.updateExpense(id, { ...input, amount: 10 }));
    expect(result.current.expenses[0].meta).toEqual({ source: "import" });

    act(() => result.current.updateExpense(id, { ...input, category: "Shopping" }));
    const meta = result.current.expenses[0].meta;
    expect(meta?.source).toBe("import");
    expect(Number.isNaN(Date.parse(meta?.recategorizedAt ?? ""))).toBe(false);
    expect(result.current.expenses[0].category).toBe("Shopping");
  });

  it("merges an update patch into the existing meta", async () => {
    const { result } = await setup();
    let id = "";
    act(() => {
      id = result.current.addExpense(input, { source: "shared-import" }).id;
    });
    act(() => result.current.updateExpense(id, input, { suggestion: SUGGESTION }));
    expect(result.current.expenses[0].meta).toEqual({ source: "shared-import", suggestion: SUGGESTION });
  });

  it("gives an edited legacy expense source manual", async () => {
    window.localStorage.setItem(KEY, JSON.stringify([expense()]));
    const { result } = await setup();
    expect(result.current.expenses[0].meta).toBeUndefined();
    act(() => result.current.updateExpense("e1", { ...input, category: "Bills" }));
    expect(result.current.expenses[0].meta?.source).toBe("manual");
    expect(result.current.expenses[0].meta?.recategorizedAt).toBeTypeOf("string");
  });

  it("keeps meta through delete and restore (undo)", async () => {
    window.localStorage.setItem(KEY, JSON.stringify([expense({ meta: FULL_META })]));
    const { result } = await setup();
    let removed: ReturnType<typeof result.current.deleteExpense>;
    act(() => {
      removed = result.current.deleteExpense("e1");
    });
    expect(result.current.expenses).toHaveLength(0);
    act(() => result.current.restoreExpenses([removed!]));
    expect(result.current.expenses[0].meta).toEqual(FULL_META);
  });

  it("keeps meta through replaceAll", async () => {
    const { result } = await setup();
    act(() => result.current.replaceAll([expense({ meta: FULL_META })]));
    expect(result.current.expenses[0].meta).toEqual(FULL_META);
  });
});
