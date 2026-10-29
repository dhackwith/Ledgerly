"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RecurringRule } from "@/lib/types";
import { generateId } from "@/lib/storage";
import { todayISO } from "@/lib/format";
import { materialize, nextOnOrAfter, upcoming as upcomingOccurrences, type RecurringRuleData, type UpcomingOccurrence } from "@/lib/recurring";
import { RECURRING_STORAGE_KEY, loadRules, saveRules } from "@/lib/recurringStorage";
import { useExpenses } from "./ExpenseProvider";
import { useToast } from "./ToastProvider";

type Status = "loading" | "ready" | "error";

interface RecurringContextValue {
  rules: RecurringRule[];
  status: Status;
  addRule: (data: RecurringRuleData) => RecurringRule;
  updateRule: (id: string, data: RecurringRuleData) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  /** The next `limit` occurrences across all active rules, soonest first. */
  upcoming: (limit: number) => UpcomingOccurrence[];
}

const RecurringContext = createContext<RecurringContextValue | null>(null);

export function useRecurring(): RecurringContextValue {
  const ctx = useContext(RecurringContext);
  if (!ctx) throw new Error("useRecurring must be used inside RecurringProvider");
  return ctx;
}

function scheduleChanged(a: RecurringRule, b: RecurringRuleData): boolean {
  return a.startDate !== b.startDate || a.frequency !== b.frequency || a.interval !== b.interval;
}

export function RecurringProvider({ children }: { children: ReactNode }) {
  const { status: expenseStatus, addMany } = useExpenses();
  const { notify } = useToast();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  // Re-checks what is due when the tab regains focus (e.g. after midnight).
  const [tick, setTick] = useState(0);
  const skipNextSave = useRef(true);
  const materializedFor = useRef<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    try {
      skipNextSave.current = true;
      setRules(loadRules());
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load recurring rules", err);
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
      saveRules(rules);
    } catch (err) {
      console.error("Failed to save recurring rules", err);
      notify("Couldn't save recurring rules to browser storage.", { variant: "error" });
    }
  }, [rules, status, notify]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECURRING_STORAGE_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Materialise due occurrences once both stores are ready. The snapshot ref guards against
  // React strict-mode double effects and against re-running for the same rule state.
  useEffect(() => {
    if (status !== "ready" || expenseStatus !== "ready") return;
    const today = todayISO();
    const snapshot = `${today}|${rules.map((r) => `${r.id}:${r.nextDate}:${r.active ? 1 : 0}`).join(",")}`;
    if (materializedFor.current === snapshot) return;
    materializedFor.current = snapshot;

    const result = materialize(rules, today);
    if (result.expenses.length === 0) return;

    // Persist the advanced nextDate in the same tick as the expenses are added, so a reload
    // between the two can't generate the same occurrences twice.
    try {
      saveRules(result.rules);
    } catch (err) {
      console.error("Failed to save recurring rules", err);
    }
    addMany(result.expenses);
    setRules(result.rules);
    const n = result.expenses.length;
    notify(`Added ${n} recurring expense${n === 1 ? "" : "s"}`, { variant: "info" });
  }, [status, expenseStatus, rules, tick, addMany, notify]);

  const addRule = useCallback((data: RecurringRuleData) => {
    const now = new Date().toISOString();
    const rule: RecurringRule = {
      ...data,
      id: generateId(),
      nextDate: data.startDate,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    setRules((list) => [rule, ...list]);
    return rule;
  }, []);

  const updateRule = useCallback((id: string, data: RecurringRuleData) => {
    setRules((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const next: RecurringRule = { ...r, ...data, endDate: data.endDate, updatedAt: new Date().toISOString() };
        // A changed schedule restarts from the new start date, without backfilling the past.
        if (scheduleChanged(r, data)) {
          const today = todayISO();
          next.nextDate = nextOnOrAfter({ ...next, nextDate: data.startDate }, data.startDate > today ? data.startDate : today);
        }
        return next;
      }),
    );
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((list) => list.filter((r) => r.id !== id));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const active = !r.active;
        const today = todayISO();
        // Resuming a paused rule skips the occurrences missed while it was off.
        const nextDate = active && r.nextDate < today ? nextOnOrAfter(r, today) : r.nextDate;
        return { ...r, active, nextDate, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const upcoming = useCallback((limit: number) => upcomingOccurrences(rules, todayISO(), limit), [rules]);

  const value = useMemo<RecurringContextValue>(
    () => ({ rules, status, addRule, updateRule, deleteRule, toggleRule, upcoming }),
    [rules, status, addRule, updateRule, deleteRule, toggleRule, upcoming],
  );

  return <RecurringContext.Provider value={value}>{children}</RecurringContext.Provider>;
}
