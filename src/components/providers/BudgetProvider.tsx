"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Category } from "@/lib/types";
import { budgetProgress, type BudgetLimits, type BudgetProgress } from "@/lib/budgets";
import { BUDGETS_STORAGE_KEY, loadBudgets, saveBudgets } from "@/lib/budgetStorage";
import { formatCurrency } from "@/lib/format";
import { useExpenses } from "./ExpenseProvider";
import { useToast } from "./ToastProvider";

type Status = "loading" | "ready" | "error";

interface BudgetContextValue {
  limits: BudgetLimits;
  status: Status;
  /** Sets a monthly limit in dollars; `null` (or a non-positive number) clears it. */
  setLimit: (category: Category, value: number | null) => void;
  /** Progress for the current calendar month, sorted over → near → ok. */
  progress: BudgetProgress[];
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function useBudgets(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudgets must be used inside BudgetProvider");
  return ctx;
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const { expenses, status: expenseStatus } = useExpenses();
  const [limits, setLimits] = useState<BudgetLimits>({});
  const [status, setStatus] = useState<Status>("loading");
  const skipNextSave = useRef(true);

  const load = useCallback(() => {
    try {
      skipNextSave.current = true;
      setLimits(loadBudgets());
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load budgets", err);
      setLimits({});
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Persist whenever limits change, but not on the initial load.
  useEffect(() => {
    if (status !== "ready") return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveBudgets(limits);
    } catch (err) {
      console.error("Failed to save budgets", err);
      notify("Couldn't save budgets to browser storage. Your latest change may be lost on reload.", { variant: "error" });
    }
  }, [limits, status, notify]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === BUDGETS_STORAGE_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  const setLimit = useCallback((category: Category, value: number | null) => {
    setLimits((current) => {
      const next = { ...current };
      if (value === null || !Number.isFinite(value) || value <= 0) {
        if (!(category in next)) return current;
        delete next[category];
      } else {
        const rounded = Math.round(value * 100) / 100;
        if (next[category] === rounded) return current;
        next[category] = rounded;
      }
      return next;
    });
  }, []);

  const progress = useMemo(() => budgetProgress(expenses, limits, new Date()), [expenses, limits]);

  // Alert when a category newly crosses into "near" or "over". The first computation after both
  // stores have loaded only seeds the refs, so nothing fires on page load.
  const seeded = useRef(false);
  const wasOver = useRef(new Set<Category>());
  const wasNear = useRef(new Set<Category>());
  useEffect(() => {
    if (expenseStatus !== "ready" || status === "loading") return;
    const over = new Set(progress.filter((p) => p.state === "over").map((p) => p.category));
    const near = new Set(progress.filter((p) => p.state === "near").map((p) => p.category));
    if (seeded.current) {
      for (const p of progress) {
        if (p.state === "over" && !wasOver.current.has(p.category)) {
          notify(
            `${p.category} is over its ${formatCurrency(p.limit)} budget this month (${formatCurrency(p.spent)} spent)`,
            { variant: "error", duration: 6000 },
          );
        } else if (p.state === "near" && !wasNear.current.has(p.category) && !wasOver.current.has(p.category)) {
          notify(
            `${p.category} is at ${Math.round(p.ratio * 100)}% of its ${formatCurrency(p.limit)} budget this month (${formatCurrency(p.remaining)} left)`,
            { variant: "info", duration: 6000 },
          );
        }
      }
    }
    seeded.current = true;
    wasOver.current = over;
    wasNear.current = near;
  }, [progress, expenseStatus, status, notify]);

  const value = useMemo<BudgetContextValue>(() => ({ limits, status, setLimit, progress }), [limits, status, setLimit, progress]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}
