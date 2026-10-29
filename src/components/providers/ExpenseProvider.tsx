"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Expense, ExpenseInput, ExpenseMeta } from "@/lib/types";
import { generateId, loadExpenses, saveExpenses } from "@/lib/storage";
import { DEFAULT_META, applyUpdate } from "@/lib/expenseMeta";
import { useToast } from "./ToastProvider";

type Status = "loading" | "ready" | "error";

interface ExpenseContextValue {
  expenses: Expense[];
  status: Status;
  loadError: string | null;
  addExpense: (input: ExpenseInput, meta?: ExpenseMeta) => Expense;
  /** `meta` merges into the expense's existing meta. */
  updateExpense: (id: string, input: ExpenseInput, meta?: Partial<ExpenseMeta>) => void;
  deleteExpense: (id: string) => Expense | undefined;
  restoreExpenses: (items: Expense[]) => void;
  /** `meta` is applied to every added expense. */
  addMany: (inputs: ExpenseInput[], meta?: ExpenseMeta) => void;
  replaceAll: (items: Expense[]) => void;
  retryLoad: () => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function useExpenses(): ExpenseContextValue {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenses must be used inside ExpenseProvider");
  return ctx;
}

function create(input: ExpenseInput, meta: ExpenseMeta = DEFAULT_META): Expense {
  const now = new Date().toISOString();
  return { ...input, id: generateId(), createdAt: now, updatedAt: now, meta: { ...meta } };
}

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const skipNextSave = useRef(true);

  const load = useCallback(() => {
    setStatus("loading");
    try {
      skipNextSave.current = true;
      setExpenses(loadExpenses());
      setLoadError(null);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load expenses", err);
      setLoadError(
        err instanceof SyntaxError
          ? "Your saved data couldn't be read. It may be corrupted."
          : "Browser storage is unavailable. Check that cookies and site data are allowed.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Persist whenever the list changes, but not on the initial load.
  useEffect(() => {
    if (status !== "ready") return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveExpenses(expenses);
    } catch (err) {
      console.error("Failed to save expenses", err);
      notify("Couldn't save to browser storage. Your latest change may be lost on reload.", { variant: "error" });
    }
  }, [expenses, status, notify]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("expense-tracker:")) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  const addExpense = useCallback((input: ExpenseInput, meta?: ExpenseMeta) => {
    const expense = create(input, meta);
    setExpenses((list) => [expense, ...list]);
    return expense;
  }, []);

  const updateExpense = useCallback((id: string, input: ExpenseInput, metaPatch?: Partial<ExpenseMeta>) => {
    const now = new Date().toISOString();
    setExpenses((list) => list.map((e) => (e.id === id ? applyUpdate(e, input, metaPatch, now) : e)));
  }, []);

  const deleteExpense = useCallback(
    (id: string) => {
      const target = expenses.find((e) => e.id === id);
      setExpenses((list) => list.filter((e) => e.id !== id));
      return target;
    },
    [expenses],
  );

  const restoreExpenses = useCallback((items: Expense[]) => {
    setExpenses((list) => {
      const existing = new Set(list.map((e) => e.id));
      return [...items.filter((i) => !existing.has(i.id)), ...list];
    });
  }, []);

  const addMany = useCallback((inputs: ExpenseInput[], meta?: ExpenseMeta) => {
    setExpenses((list) => [...inputs.map((input) => create(input, meta)), ...list]);
  }, []);

  const replaceAll = useCallback((items: Expense[]) => setExpenses(items), []);

  const value = useMemo<ExpenseContextValue>(
    () => ({
      expenses,
      status,
      loadError,
      addExpense,
      updateExpense,
      deleteExpense,
      restoreExpenses,
      addMany,
      replaceAll,
      retryLoad: load,
    }),
    [expenses, status, loadError, addExpense, updateExpense, deleteExpense, restoreExpenses, addMany, replaceAll, load],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}
