"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, type RecurringRule } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { todayISO } from "@/lib/format";
import { MAX_DESCRIPTION } from "@/lib/validation";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  MAX_INTERVAL,
  MIN_INTERVAL,
  validateRule,
  type RecurringRuleData,
  type RecurringRuleFormErrors,
  type RecurringRuleFormValues,
} from "@/lib/recurring";
import { Button } from "@/components/ui/Button";

interface RecurringRuleFormProps {
  initial?: RecurringRule;
  onSubmit: (data: RecurringRuleData) => void | Promise<void>;
  onCancel: () => void;
}

const inputBase =
  "block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset";

function fieldClass(hasError: boolean): string {
  return `${inputBase} ${hasError ? "ring-red-300 focus:ring-red-500" : "ring-slate-300 focus:ring-brand-600"}`;
}

const FIELDS: Array<keyof RecurringRuleFormValues> = [
  "description",
  "amount",
  "category",
  "frequency",
  "interval",
  "startDate",
  "endDate",
];

export function RecurringRuleForm({ initial, onSubmit, onCancel }: RecurringRuleFormProps) {
  const [values, setValues] = useState<RecurringRuleFormValues>({
    description: initial?.description ?? "",
    amount: initial ? initial.amount.toFixed(2) : "",
    category: initial?.category ?? "",
    frequency: initial?.frequency ?? "monthly",
    interval: initial ? String(initial.interval) : "1",
    startDate: initial?.startDate ?? todayISO(),
    endDate: initial?.endDate ?? "",
  });
  const [errors, setErrors] = useState<RecurringRuleFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RecurringRuleFormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof RecurringRuleFormValues, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Re-validate live once the user has interacted with the field.
    if (touched[field] || errors[field]) setErrors(validateRule(next).errors);
  };

  const blur = (field: keyof RecurringRuleFormValues) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const fieldError = validateRule(values).errors[field];
    setErrors((e) => ({ ...e, [field]: fieldError }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const result = validateRule(values);
    setErrors(result.errors);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));
    if (!result.data) {
      const firstInvalid = FIELDS.find((f) => result.errors[f]);
      document.getElementById(`rule-${firstInvalid}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (err) {
      console.error(err);
      setSubmitError("Something went wrong saving this rule. Please try again.");
      setSubmitting(false);
    }
  };

  const unit = FREQUENCY_LABELS[values.frequency as keyof typeof FREQUENCY_LABELS] ?? FREQUENCY_LABELS.monthly;
  const intervalNumber = Number(values.interval);
  const unitLabel = intervalNumber === 1 ? unit.singular : unit.plural;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="rule-description" className="block text-sm font-medium text-slate-700">
            Description
          </label>
          <span className={`text-xs tabular-nums ${values.description.length > MAX_DESCRIPTION ? "text-red-600" : "text-slate-400"}`}>
            {values.description.length}/{MAX_DESCRIPTION}
          </span>
        </div>
        <input
          id="rule-description"
          data-autofocus
          type="text"
          autoComplete="off"
          placeholder="e.g. Rent, Netflix, Gym membership"
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          onBlur={() => blur("description")}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "rule-description-error" : undefined}
          className={`${fieldClass(!!errors.description)} mt-1.5`}
        />
        {errors.description && (
          <p id="rule-description-error" className="mt-1.5 text-xs text-red-600">
            {errors.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="rule-amount" className="block text-sm font-medium text-slate-700">
            Amount
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">$</span>
            <input
              id="rule-amount"
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
              aria-describedby={errors.amount ? "rule-amount-error" : undefined}
              className={`${fieldClass(!!errors.amount)} pl-7 tabular-nums`}
            />
          </div>
          {errors.amount && (
            <p id="rule-amount-error" className="mt-1.5 text-xs text-red-600">
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="rule-frequency" className="block text-sm font-medium text-slate-700">
            Repeats
          </label>
          <select
            id="rule-frequency"
            value={values.frequency}
            onChange={(e) => {
              setTouched((t) => ({ ...t, frequency: true }));
              update("frequency", e.target.value);
            }}
            onBlur={() => blur("frequency")}
            aria-invalid={!!errors.frequency}
            aria-describedby={errors.frequency ? "rule-frequency-error" : undefined}
            className={`${fieldClass(!!errors.frequency)} mt-1.5`}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f].label}
              </option>
            ))}
          </select>
          {errors.frequency && (
            <p id="rule-frequency-error" className="mt-1.5 text-xs text-red-600">
              {errors.frequency}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="rule-interval" className="block text-sm font-medium text-slate-700">
          Every
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="rule-interval"
            type="number"
            inputMode="numeric"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            step={1}
            value={values.interval}
            onChange={(e) => update("interval", e.target.value)}
            onBlur={() => blur("interval")}
            aria-invalid={!!errors.interval}
            aria-describedby={errors.interval ? "rule-interval-error" : "rule-interval-hint"}
            className={`${fieldClass(!!errors.interval)} w-24 tabular-nums`}
          />
          <span id="rule-interval-hint" className="text-sm text-slate-600">
            {unitLabel}
          </span>
        </div>
        {errors.interval && (
          <p id="rule-interval-error" className="mt-1.5 text-xs text-red-600">
            {errors.interval}
          </p>
        )}
      </div>

      <fieldset>
        <legend id="rule-category" tabIndex={-1} className="block text-sm font-medium text-slate-700 outline-none">
          Category
        </legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="rule-category">
          {CATEGORIES.map((c) => {
            const selected = values.category === c;
            return (
              <label
                key={c}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset transition ${
                  selected
                    ? "bg-brand-50 font-semibold text-brand-700 ring-2 ring-brand-600"
                    : `bg-white text-slate-700 hover:bg-slate-50 ${errors.category ? "ring-red-300" : "ring-slate-300"}`
                }`}
              >
                <input
                  type="radio"
                  name="rule-category"
                  value={c}
                  checked={selected}
                  onChange={() => {
                    setTouched((t) => ({ ...t, category: true }));
                    update("category", c);
                    setErrors((e) => ({ ...e, category: undefined }));
                  }}
                  className="sr-only"
                />
                <span aria-hidden>{CATEGORY_META[c].icon}</span>
                {c}
              </label>
            );
          })}
        </div>
        {errors.category && <p className="mt-1.5 text-xs text-red-600">{errors.category}</p>}
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="rule-startDate" className="block text-sm font-medium text-slate-700">
            Start date
          </label>
          <input
            id="rule-startDate"
            type="date"
            value={values.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            onBlur={() => blur("startDate")}
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? "rule-startDate-error" : undefined}
            className={`${fieldClass(!!errors.startDate)} mt-1.5`}
          />
          {errors.startDate && (
            <p id="rule-startDate-error" className="mt-1.5 text-xs text-red-600">
              {errors.startDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="rule-endDate" className="block text-sm font-medium text-slate-700">
            End date <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="rule-endDate"
            type="date"
            min={values.startDate || undefined}
            value={values.endDate}
            onChange={(e) => update("endDate", e.target.value)}
            onBlur={() => blur("endDate")}
            aria-invalid={!!errors.endDate}
            aria-describedby={errors.endDate ? "rule-endDate-error" : undefined}
            className={`${fieldClass(!!errors.endDate)} mt-1.5`}
          />
          {errors.endDate && (
            <p id="rule-endDate-error" className="mt-1.5 text-xs text-red-600">
              {errors.endDate}
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
          {initial ? "Save changes" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}
