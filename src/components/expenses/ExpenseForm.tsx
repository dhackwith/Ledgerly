"use client";

import { useState, type FormEvent } from "react";
import {
  CATEGORIES,
  type Category,
  type Expense,
  type ExpenseInput,
  type SuggestionDisplay,
  type SuggestionRecord,
} from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import { MAX_DESCRIPTION, validateExpense, type ExpenseFormErrors, type ExpenseFormValues } from "@/lib/validation";
import { MODEL_VERSION } from "@/lib/ml";
import { recordFeedback } from "@/lib/ml/feedback";
import { Button } from "@/components/ui/Button";
import { CategorySuggestions, SUGGESTION_REASON_ID, SuggestionErrorBoundary } from "./CategorySuggestions";
import { useCategorySuggestions } from "./useCategorySuggestions";

interface ExpenseFormProps {
  initial?: Expense;
  /** `suggestion` is the category suggestion that was showing at submit time, if any. */
  onSubmit: (data: ExpenseInput, suggestion?: SuggestionRecord) => void | Promise<void>;
  onCancel: () => void;
}

/** Visual order, used to focus the first invalid field. */
const FIELD_ORDER: Array<keyof ExpenseFormValues> = ["amount", "description", "category", "date"];

const inputBase =
  "block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset";

function fieldClass(hasError: boolean): string {
  return `${inputBase} ${hasError ? "ring-red-300 focus:ring-red-500" : "ring-slate-300 focus:ring-brand-600"}`;
}

export function ExpenseForm({ initial, onSubmit, onCancel }: ExpenseFormProps) {
  const isEdit = !!initial;
  // In create mode `category` stays "" until the user picks one; a pre-selected suggestion is applied on top.
  const [values, setValues] = useState<ExpenseFormValues>({
    date: initial?.date ?? todayISO(),
    amount: initial ? initial.amount.toFixed(2) : "",
    category: initial?.category ?? "",
    description: initial?.description ?? "",
  });
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ExpenseFormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suggestionsFailed, setSuggestionsFailed] = useState(false);

  const { result: engineResult, enabled } = useCategorySuggestions({
    description: values.description,
    amount: values.amount,
    date: values.date,
    mode: isEdit ? "edit" : "create",
    currentCategory: initial?.category,
    excludeId: initial?.id,
  });

  const suggestion = suggestionsFailed ? null : engineResult;
  const suggested: Category | undefined = suggestion?.ranked[0]?.category;
  let display: SuggestionDisplay = "none";
  if (suggestion && suggested) {
    // Edit mode never pre-selects: it shows chips only when the engine asks for them.
    display = isEdit ? (suggestion.display === "chips" ? "chips" : "none") : suggestion.display;
  }
  // Pre-select only while the user hasn't chosen. Their choice is never changed.
  const autoCategory = display === "preselected" && !values.category ? suggested : undefined;
  const withSuggestion = (v: ExpenseFormValues): ExpenseFormValues =>
    v.category || !autoCategory ? v : { ...v, category: autoCategory };
  const category = values.category || autoCategory || "";
  const categoryError = category ? undefined : errors.category;

  const update = (field: keyof ExpenseFormValues, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Re-validate live once the user has interacted with the field.
    if (touched[field] || errors[field]) setErrors(validateExpense(withSuggestion(next)).errors);
  };

  const blur = (field: keyof ExpenseFormValues) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const fieldError = validateExpense(withSuggestion(values)).errors[field];
    setErrors((e) => ({ ...e, [field]: fieldError }));
  };

  const chooseCategory = (c: Category) => {
    setTouched((t) => ({ ...t, category: true }));
    update("category", c);
    setErrors((e) => ({ ...e, category: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    // The submitted category is exactly the one shown as selected, so nothing unseen is ever saved.
    const result = validateExpense(withSuggestion(values));
    setErrors(result.errors);
    setTouched({ date: true, amount: true, category: true, description: true });
    if (!result.data) {
      const firstInvalid = FIELD_ORDER.find((f) => result.errors[f]);
      document.getElementById(`expense-${firstInvalid}`)?.focus();
      return;
    }
    const data = result.data;
    const record: SuggestionRecord | undefined =
      suggestion && suggested && display !== "none"
        ? {
            category: suggested,
            confidence: suggestion.confidence,
            shown: display,
            accepted: data.category === suggested,
            modelVersion: suggestion.modelVersion,
          }
        : undefined;
    setSubmitting(true);
    try {
      await (record ? onSubmit(data, record) : onSubmit(data));
    } catch (err) {
      console.error(err);
      setSubmitError("Something went wrong saving this expense. Please try again.");
      setSubmitting(false);
      return;
    }
    // Feedback is best effort and must never affect saving.
    if (!record && !enabled) return;
    try {
      recordFeedback({
        t: new Date().toISOString(),
        predicted: record?.category ?? null,
        confidence: record?.confidence ?? 0,
        final: data.category,
        shown: record?.shown ?? "none",
        modelVersion: record?.modelVersion ?? engineResult?.modelVersion ?? MODEL_VERSION,
      });
    } catch (err) {
      console.error("Failed to record suggestion feedback", err);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="expense-amount" className="block text-sm font-medium text-slate-700">
            Amount
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">$</span>
            <input
              id="expense-amount"
              data-autofocus
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={values.amount}
              onChange={(e) => update("amount", e.target.value)}
              onBlur={() => {
                blur("amount");
                const n = Number(values.amount.replace(/[$,\s]/g, ""));
                if (values.amount.trim() && Number.isFinite(n) && n > 0 && /^\$?[\d,]*\.?\d{0,2}$/.test(values.amount.trim())) {
                  setValues((v) => ({ ...v, amount: n.toFixed(2) }));
                }
              }}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "expense-amount-error" : undefined}
              className={`${fieldClass(!!errors.amount)} pl-7 tabular-nums`}
            />
          </div>
          {errors.amount && (
            <p id="expense-amount-error" className="mt-1.5 text-xs text-red-600">
              {errors.amount}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="expense-description" className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <span className={`text-xs tabular-nums ${values.description.length > MAX_DESCRIPTION ? "text-red-600" : "text-slate-400"}`}>
              {values.description.length}/{MAX_DESCRIPTION}
            </span>
          </div>
          <input
            id="expense-description"
            type="text"
            autoComplete="off"
            placeholder="e.g. Weekly groceries"
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            onBlur={() => blur("description")}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "expense-description-error" : undefined}
            className={`${fieldClass(!!errors.description)} mt-1.5`}
          />
          {errors.description && (
            <p id="expense-description-error" className="mt-1.5 text-xs text-red-600">
              {errors.description}
            </p>
          )}
        </div>
      </div>

      <fieldset>
        <legend id="expense-category" tabIndex={-1} className="block text-sm font-medium text-slate-700 outline-none">
          Category
        </legend>
        <SuggestionErrorBoundary onError={() => setSuggestionsFailed(true)}>
          <CategorySuggestions
            display={display}
            ranked={suggestion?.ranked ?? []}
            reason={suggestion?.reason ?? null}
            autoSelected={!!autoCategory}
            onChoose={chooseCategory}
          />
        </SuggestionErrorBoundary>
        {/* mt-3 and gap-y-3 leave room for the "Suggested" tag that overhangs a tile's top edge. */}
        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3" role="radiogroup" aria-labelledby="expense-category">
          {CATEGORIES.map((c) => {
            const selected = category === c;
            const tagged = display === "preselected" && suggested === c;
            return (
              <label
                key={c}
                className={`relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset transition ${
                  selected
                    ? "bg-brand-50 font-semibold text-brand-700 ring-2 ring-brand-600"
                    : `bg-white text-slate-700 hover:bg-slate-50 ${categoryError ? "ring-red-300" : "ring-slate-300"}`
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={selected}
                  onChange={() => chooseCategory(c)}
                  // Clicking the already pre-selected tile doesn't fire onChange; this makes it the user's choice.
                  onClick={() => chooseCategory(c)}
                  aria-describedby={tagged ? SUGGESTION_REASON_ID : undefined}
                  className="sr-only"
                />
                <span aria-hidden>{CATEGORY_META[c].icon}</span>
                {c}
                {/* Sits on the tile's top edge, so a suggestion never changes tile height or shifts the form. */}
                {tagged && (
                  <span
                    data-testid="suggested-tag"
                    className="absolute -top-2 right-2 rounded bg-brand-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-brand-700 ring-1 ring-brand-200"
                  >
                    Suggested
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {categoryError && <p className="mt-1.5 text-xs text-red-600">{categoryError}</p>}
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="expense-date" className="block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            max={todayISO()}
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
            onBlur={() => blur("date")}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? "expense-date-error" : undefined}
            className={`${fieldClass(!!errors.date)} mt-1.5`}
          />
          {errors.date && (
            <p id="expense-date-error" className="mt-1.5 text-xs text-red-600">
              {errors.date}
            </p>
          )}
        </div>
      </div>

      {submitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
