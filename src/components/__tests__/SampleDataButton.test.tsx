// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Expense } from "@/lib/types";
import { installLocalStorage } from "@/lib/__tests__/localStorage";
import { ExpenseProvider, useExpenses } from "@/components/providers/ExpenseProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { SampleDataButton } from "../SampleDataButton";

installLocalStorage();

let expenses: Expense[] = [];
function Probe() {
  expenses = useExpenses().expenses;
  return null;
}

describe("SampleDataButton", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("tags every sample expense with source sample", async () => {
    render(
      <ToastProvider>
        <ExpenseProvider>
          <SampleDataButton />
          <Probe />
        </ExpenseProvider>
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /load sample data/i }));
    await waitFor(() => expect(expenses.length).toBeGreaterThan(0));
    for (const e of expenses) expect(e.meta).toEqual({ source: "sample" });
  });
});
