// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense, ExpenseInput, SuggestionRecord } from "@/lib/types";
import { FULL_META, SUGGESTION, expense } from "@/lib/__tests__/metaFixtures";
import { installLocalStorage } from "@/lib/__tests__/localStorage";
import { ExpenseProvider, useExpenses } from "../ExpenseProvider";
import { ExpenseDialogProvider, useExpenseDialogs } from "../ExpenseDialogProvider";
import { ToastProvider } from "../ToastProvider";

installLocalStorage();

// The real form belongs to another feature; this stand-in submits with or without a suggestion.
vi.mock("@/components/expenses/ExpenseForm", () => ({
  ExpenseForm: ({ initial, onSubmit }: { initial?: Expense; onSubmit: (data: ExpenseInput, suggestion?: SuggestionRecord) => void }) => {
    const data: ExpenseInput = { date: "2026-10-05", amount: 4, category: initial ? "Bills" : "Food", description: "Bagel" };
    return (
      <div>
        <button type="button" onClick={() => onSubmit(data, { category: "Food", confidence: 0.82, shown: "preselected", accepted: true, modelVersion: "test-model-1" })}>
          Submit with suggestion
        </button>
        <button type="button" onClick={() => onSubmit(data)}>
          Submit without suggestion
        </button>
      </div>
    );
  },
}));

const KEY = "expense-tracker:expenses:v1";
let api: { expenses: Expense[]; dialogs: ReturnType<typeof useExpenseDialogs> };

function Probe() {
  const { expenses } = useExpenses();
  const dialogs = useExpenseDialogs();
  api = { expenses, dialogs };
  return null;
}

async function setup(stored: Expense[] = []) {
  window.localStorage.setItem(KEY, JSON.stringify(stored));
  render(
    <ToastProvider>
      <ExpenseProvider>
        <ExpenseDialogProvider>
          <Probe />
        </ExpenseDialogProvider>
      </ExpenseProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(api.expenses).toHaveLength(stored.length));
}

describe("ExpenseDialogProvider meta pass-through", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("stores the form's suggestion on create", async () => {
    await setup();
    act(() => api.dialogs.openAdd());
    await userEvent.click(screen.getByRole("button", { name: "Submit with suggestion" }));
    expect(api.expenses[0].meta).toEqual({ source: "manual", suggestion: SUGGESTION });
  });

  it("stores source manual without a suggestion key when none was shown", async () => {
    await setup();
    act(() => api.dialogs.openAdd());
    await userEvent.click(screen.getByRole("button", { name: "Submit without suggestion" }));
    expect(api.expenses[0].meta).toEqual({ source: "manual" });
    expect("suggestion" in api.expenses[0].meta!).toBe(false);
  });

  it("merges the suggestion on edit and marks the recategorization", async () => {
    await setup([expense({ meta: { source: "import" } })]);
    act(() => api.dialogs.openEdit(api.expenses[0]));
    await userEvent.click(screen.getByRole("button", { name: "Submit with suggestion" }));
    const meta = api.expenses[0].meta!;
    expect(meta.source).toBe("import");
    expect(meta.suggestion).toEqual(SUGGESTION);
    expect(meta.recategorizedAt).toBeTypeOf("string");
  });

  it("keeps existing meta on an edit without a suggestion", async () => {
    await setup([expense({ category: "Bills", meta: FULL_META })]);
    act(() => api.dialogs.openEdit(api.expenses[0]));
    await userEvent.click(screen.getByRole("button", { name: "Submit without suggestion" }));
    expect(api.expenses[0].meta).toEqual(FULL_META);
  });

  it("keeps meta when a delete is undone", async () => {
    await setup([expense({ meta: FULL_META })]);
    act(() => api.dialogs.confirmDelete(api.expenses[0]));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.expenses).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(api.expenses[0]).toEqual(expense({ meta: FULL_META }));
  });
});
