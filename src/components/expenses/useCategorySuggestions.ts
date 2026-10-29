"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CATEGORIES, type Category, type SuggestionDisplay } from "@/lib/types";
import { validateExpense } from "@/lib/validation";
import { createSuggester } from "@/lib/ml";
import type { Suggester, SuggestionQuery, SuggestionResult } from "@/lib/ml/contract";
import { DEFAULT_ML_SETTINGS, getMlSettings, subscribeMlSettings } from "@/lib/ml/settings";
import { useExpenses } from "@/components/providers/ExpenseProvider";

export const SUGGEST_DEBOUNCE_MS = 150;
/** Shorter descriptions never get a suggestion. */
export const MIN_SUGGEST_LENGTH = 2;

export interface CategorySuggestionInput {
  description: string;
  /** Raw amount field text. Passed to the engine only when it's a valid amount. */
  amount: string;
  /** Raw date field value. Passed to the engine only when it's a valid date. */
  date: string;
  mode: "create" | "edit";
  /** In edit mode, the expense's saved category. */
  currentCategory?: Category;
}

export interface CategorySuggestionState {
  /** Latest engine result, or null when there's nothing to show (off, short text, failure, server render). */
  result: SuggestionResult | null;
  /** Whether smart suggestions are turned on. */
  enabled: boolean;
}

const DISPLAYS: readonly SuggestionDisplay[] = ["preselected", "chips", "none"];

const getServerSettings = () => DEFAULT_ML_SETTINGS;

/** Guards the form against a malformed result: known categories only, at most 3, valid display. */
function sanitize(result: SuggestionResult): SuggestionResult {
  const ranked = (result.ranked ?? [])
    .filter((r) => (CATEGORIES as readonly string[]).includes(r.category) && Number.isFinite(r.p))
    .slice(0, 3);
  const display = ranked.length > 0 && DISPLAYS.includes(result.display) ? result.display : "none";
  const confidence = Number.isFinite(result.confidence) ? result.confidence : 0;
  return { ...result, ranked, display, confidence, reason: result.reason ?? null };
}

/**
 * Debounced category suggestions for the expense form. Reads the user's expenses and the ML settings,
 * and never throws: any engine failure means "no suggestion" and is logged once.
 */
export function useCategorySuggestions({
  description,
  amount,
  date,
  mode,
  currentCategory,
}: CategorySuggestionInput): CategorySuggestionState {
  const { expenses } = useExpenses();
  // The server snapshot is the defaults (off), so server and hydration renders match.
  const settings = useSyncExternalStore(subscribeMlSettings, getMlSettings, getServerSettings);
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const logged = useRef(false);

  const logOnce = useCallback((err: unknown) => {
    if (logged.current) return;
    logged.current = true;
    console.error("Category suggestions are unavailable", err);
  }, []);

  // Rebuilt whenever the expenses change, so undo, delete, imports and other tabs are picked up.
  const built = useMemo<{ suggester: Suggester } | { error: unknown } | null>(() => {
    if (!settings.enabled) return null;
    try {
      return { suggester: createSuggester(expenses, { ignoreSuggestionMetaBefore: settings.resetAt }) };
    } catch (error) {
      return { error };
    }
  }, [expenses, settings.enabled, settings.resetAt]);

  const text = description.trim();
  const fieldErrors = validateExpense({ date, amount, category: "", description: "" }).errors;
  const parsedAmount = fieldErrors.amount
    ? undefined
    : Math.round(Number(amount.trim().replace(/[$,\s]/g, "")) * 100) / 100;
  const parsedDate = fieldErrors.date ? undefined : date;

  useEffect(() => {
    if (!built || text.length < MIN_SUGGEST_LENGTH) {
      setResult(null);
      return;
    }
    if ("error" in built) {
      logOnce(built.error);
      setResult(null);
      return;
    }
    const query: SuggestionQuery = { description: text, mode };
    if (parsedAmount !== undefined) query.amount = parsedAmount;
    if (parsedDate !== undefined) query.date = parsedDate;
    if (currentCategory) query.currentCategory = currentCategory;
    // Keep showing the previous result until the new one is ready, so the UI doesn't flicker.
    const timer = setTimeout(() => {
      try {
        setResult(sanitize(built.suggester.suggest(query)));
      } catch (err) {
        logOnce(err);
        setResult(null);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [built, text, parsedAmount, parsedDate, mode, currentCategory, logOnce]);

  return { result, enabled: settings.enabled };
}
