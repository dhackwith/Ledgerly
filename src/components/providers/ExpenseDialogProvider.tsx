"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Expense, ExpenseInput, SuggestionRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { useExpenses } from "./ExpenseProvider";
import { useToast } from "./ToastProvider";

interface ExpenseDialogContextValue {
  openAdd: () => void;
  openEdit: (expense: Expense) => void;
  confirmDelete: (expense: Expense) => void;
}

const ExpenseDialogContext = createContext<ExpenseDialogContextValue | null>(null);

export function useExpenseDialogs(): ExpenseDialogContextValue {
  const ctx = useContext(ExpenseDialogContext);
  if (!ctx) throw new Error("useExpenseDialogs must be used inside ExpenseDialogProvider");
  return ctx;
}

type DialogState = { kind: "closed" } | { kind: "add" } | { kind: "edit"; expense: Expense } | { kind: "delete"; expense: Expense };

export function ExpenseDialogProvider({ children }: { children: ReactNode }) {
  const { addExpense, updateExpense, deleteExpense, restoreExpenses } = useExpenses();
  const { notify } = useToast();
  const [state, setState] = useState<DialogState>({ kind: "closed" });
  // Bumped on every open so the form remounts with fresh values.
  const [formKey, setFormKey] = useState(0);

  const close = useCallback(() => setState({ kind: "closed" }), []);

  const openAdd = useCallback(() => {
    setFormKey((k) => k + 1);
    setState({ kind: "add" });
  }, []);

  const openEdit = useCallback((expense: Expense) => {
    setFormKey((k) => k + 1);
    setState({ kind: "edit", expense });
  }, []);

  const confirmDelete = useCallback((expense: Expense) => setState({ kind: "delete", expense }), []);

  const handleSubmit = (data: ExpenseInput, suggestion?: SuggestionRecord) => {
    if (state.kind === "edit") {
      updateExpense(state.expense.id, data, suggestion ? { suggestion } : undefined);
      notify("Expense updated");
    } else {
      addExpense(data, suggestion ? { source: "manual", suggestion } : { source: "manual" });
      notify(`Added ${formatCurrency(data.amount)} for ${data.description}`);
    }
    close();
  };

  const handleDelete = () => {
    if (state.kind !== "delete") return;
    const removed = deleteExpense(state.expense.id);
    close();
    if (removed) {
      notify("Expense deleted", {
        variant: "info",
        action: { label: "Undo", onClick: () => restoreExpenses([removed]) },
      });
    }
  };

  const value = useMemo(() => ({ openAdd, openEdit, confirmDelete }), [openAdd, openEdit, confirmDelete]);

  return (
    <ExpenseDialogContext.Provider value={value}>
      {children}

      <Modal
        open={state.kind === "add" || state.kind === "edit"}
        onClose={close}
        title={state.kind === "edit" ? "Edit expense" : "Add expense"}
        description={state.kind === "edit" ? "Update the details of this expense." : "Record a new expense."}
      >
        <ExpenseForm
          key={formKey}
          initial={state.kind === "edit" ? state.expense : undefined}
          onSubmit={handleSubmit}
          onCancel={close}
        />
      </Modal>

      <Modal open={state.kind === "delete"} onClose={close} title="Delete expense?" size="sm">
        {state.kind === "delete" && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              This will remove <span className="font-semibold text-slate-900">{state.expense.description}</span> (
              {formatCurrency(state.expense.amount)}). You can undo this right after.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={close} data-autofocus>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ExpenseDialogContext.Provider>
  );
}
