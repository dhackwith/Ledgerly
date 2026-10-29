"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { CATEGORIES, type Category } from "@/lib/types";
import { budgetSummary, countLimits, projectedMonthEnd, type BudgetProgress } from "@/lib/budgets";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatMonthKey, formatPercent, monthKey, todayISO } from "@/lib/format";
import { MAX_AMOUNT } from "@/lib/validation";
import { useBudgets } from "@/components/providers/BudgetProvider";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { BudgetBar, BudgetStateLabel } from "@/components/budgets/BudgetBar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TargetIcon } from "@/components/ui/Icons";

/** Parses a typed limit. Returns `null` for an empty value, `undefined` when invalid. */
function parseLimit(text: string): number | null | undefined {
  const cleaned = text.trim().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value >= MAX_AMOUNT) return undefined;
  return Math.round(value * 100) / 100;
}

function toInputValue(limit: number | undefined): string {
  return limit === undefined ? "" : String(limit);
}

interface LimitInputProps {
  category: Category;
  limit: number | undefined;
  onSave: (value: number | null) => void;
}

function LimitInput({ category, limit, onSave }: LimitInputProps) {
  const id = useId();
  const [text, setText] = useState(() => toInputValue(limit));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirror external changes (another tab, a cleared limit) while the field is not being edited.
  useEffect(() => {
    if (!focused) setText(toInputValue(limit));
  }, [limit, focused]);

  const commit = () => {
    const parsed = parseLimit(text);
    if (parsed === undefined) {
      setError("Enter a positive amount under $1,000,000 with up to 2 decimals.");
      return false;
    }
    setError(null);
    onSave(parsed);
    setText(toInputValue(parsed ?? undefined));
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (commit()) e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setText(toInputValue(limit));
      setError(null);
      e.currentTarget.blur();
    }
  };

  return (
    <div className="w-full sm:w-40">
      <label htmlFor={id} className="sr-only">
        Monthly limit for {category}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400" aria-hidden>
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="No limit"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`block w-full rounded-lg border-0 py-2 pl-7 pr-3 text-right text-sm tabular-nums text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 ${
            error ? "ring-red-400" : "ring-slate-300"
          }`}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ProjectionHint({ progress, projected }: { progress: BudgetProgress; projected: number }) {
  const overBy = projected - progress.limit;
  return (
    <p className="text-xs text-slate-500">
      {overBy > 0 ? (
        <>
          At this pace you&apos;ll spend about <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(projected)}</span>{" "}
          by month end, {formatCurrency(overBy)} over the limit.
        </>
      ) : (
        <>
          On pace for about <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(projected)}</span> by month end,
          within the limit.
        </>
      )}
    </p>
  );
}

interface CategoryRowProps {
  category: Category;
  limit: number | undefined;
  progress: BudgetProgress | undefined;
  projected: number;
  spentThisMonth: number;
  onSave: (value: number | null) => void;
}

function CategoryRow({ category, limit, progress, projected, spentThisMonth, onSave }: CategoryRowProps) {
  const meta = CATEGORY_META[category];
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
              style={{ backgroundColor: `${meta.color}1a` }}
              aria-hidden
            >
              {meta.icon}
            </span>
            {category}
          </h3>
          {progress ? (
            <BudgetStateLabel progress={progress} />
          ) : (
            <span className="text-xs font-medium text-slate-400">No budget set</span>
          )}
        </div>
        {progress ? (
          <>
            <BudgetBar progress={progress} />
            <p className="text-xs tabular-nums text-slate-500">
              {formatCurrency(progress.spent)} of {formatCurrency(progress.limit)} spent ·{" "}
              {progress.remaining >= 0
                ? `${formatCurrency(progress.remaining)} left`
                : `${formatCurrency(Math.abs(progress.remaining))} over`}
            </p>
            {progress.state !== "ok" && <ProjectionHint progress={progress} projected={projected} />}
          </>
        ) : (
          <p className="text-xs tabular-nums text-slate-500">{formatCurrency(spentThisMonth)} spent this month</p>
        )}
      </div>
      <LimitInput category={category} limit={limit} onSave={onSave} />
    </li>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading budgets">
      <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
        <div className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-3 h-8 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-2.5 w-full" />
      </div>
      <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2.5 w-full" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { expenses, status: expenseStatus } = useExpenses();
  const { limits, status: budgetStatus, setLimit, progress } = useBudgets();

  const now = useMemo(() => new Date(), []);
  const monthLabel = formatMonthKey(monthKey(todayISO()), "long");
  const loading = expenseStatus === "loading" || budgetStatus === "loading";
  const limitCount = countLimits(limits);
  const summary = useMemo(() => budgetSummary(progress), [progress]);
  const byCategory = useMemo(() => new Map(progress.map((p) => [p.category, p])), [progress]);
  const spentByCategory = useMemo(() => {
    const key = monthKey(todayISO());
    const cents = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
    for (const e of expenses) {
      if (monthKey(e.date) === key) cents.set(e.category, (cents.get(e.category) ?? 0) + Math.round(e.amount * 100));
    }
    return cents;
  }, [expenses]);

  const overallRatio = Math.min(summary.ratio, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Budgets</h1>
        <p className="text-sm text-slate-500">
          Monthly limits per category for <span className="font-medium text-slate-700">{monthLabel}</span>. Limits reset
          every calendar month.
        </p>
      </div>

      {loading && <PageSkeleton />}

      {!loading && (
        <>
          {limitCount === 0 ? (
            <Card>
              <EmptyState
                icon={<TargetIcon className="h-6 w-6" />}
                title="Set up budgets"
                description="Enter a monthly limit next to any category below. You'll see progress bars here and on the dashboard, and get a heads-up when you're close to or over a limit."
              />
            </Card>
          ) : (
            <Card bodyClassName="p-5">
              <div className="grid gap-6 sm:grid-cols-3">
                <SummaryTile
                  label="Budgeted"
                  value={formatCurrency(summary.budgeted)}
                  hint={`${limitCount} of ${CATEGORIES.length} categories`}
                />
                <SummaryTile label="Spent" value={formatCurrency(summary.spent)} hint={`${formatPercent(summary.ratio)} of budget`} />
                <SummaryTile
                  label={summary.remaining >= 0 ? "Remaining" : "Over budget"}
                  value={formatCurrency(Math.abs(summary.remaining))}
                  hint={
                    summary.counts.over > 0
                      ? `${summary.counts.over} over, ${summary.counts.near} near limit`
                      : summary.counts.near > 0
                        ? `${summary.counts.near} near limit`
                        : "All categories on track"
                  }
                />
              </div>
              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span id="overall-budget-label">Overall</span>
                  <span className="tabular-nums">{formatPercent(summary.ratio)} used</span>
                </div>
                <div
                  role="progressbar"
                  aria-labelledby="overall-budget-label"
                  aria-valuemin={0}
                  aria-valuemax={summary.budgeted}
                  aria-valuenow={Math.min(summary.spent, summary.budgeted)}
                  aria-valuetext={`${formatCurrency(summary.spent)} of ${formatCurrency(summary.budgeted)}, ${formatPercent(summary.ratio)} used`}
                  className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      summary.ratio > 1 ? "bg-red-500" : summary.ratio >= 0.8 ? "bg-amber-500" : "bg-brand-600"
                    }`}
                    style={{ width: `${overallRatio * 100}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          <Card title="Categories" subtitle="Type a limit and press Enter or click away to save. Clear the field to remove it." bodyClassName="">
            <ul className="divide-y divide-slate-100">
              {CATEGORIES.map((category) => (
                <CategoryRow
                  key={category}
                  category={category}
                  limit={limits[category]}
                  progress={byCategory.get(category)}
                  projected={projectedMonthEnd(expenses, category, now)}
                  spentThisMonth={(spentByCategory.get(category) ?? 0) / 100}
                  onSave={(value) => setLimit(category, value)}
                />
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
