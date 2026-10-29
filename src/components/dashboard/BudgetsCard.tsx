"use client";

import Link from "next/link";
import { overLimitCategories } from "@/lib/budgets";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { useBudgets } from "@/components/providers/BudgetProvider";
import { BudgetBar, BudgetStateLabel } from "@/components/budgets/BudgetBar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AlertTriangleIcon } from "@/components/ui/Icons";

const MAX_ROWS = 4;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Slim banner shown when any category is over its monthly limit. */
export function BudgetAlertBanner() {
  const { progress, status } = useBudgets();
  if (status !== "ready") return null;
  const over = overLimitCategories(progress);
  if (over.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200"
    >
      <AlertTriangleIcon className="h-4 w-4 shrink-0 text-red-600" />
      <p className="flex-1">
        <span className="font-semibold">Over budget this month:</span> {joinNames(over)}.
      </p>
      <Link href="/budgets" className="font-semibold text-red-700 underline-offset-2 hover:underline">
        Review budgets
      </Link>
    </div>
  );
}

/** Dashboard card with compact progress bars for the categories that need attention most. */
export function BudgetsCard() {
  const { progress, status } = useBudgets();
  const manage = (
    <Link href="/budgets" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
      Manage budgets
    </Link>
  );

  if (status === "loading") {
    return (
      <Card title="Budgets" action={manage}>
        <div className="space-y-3" role="status" aria-label="Loading budgets">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-2.5 w-full" />
        </div>
      </Card>
    );
  }

  if (progress.length === 0) {
    return (
      <Card title="Budgets" action={manage}>
        <p className="text-sm text-slate-500">
          No monthly limits yet.{" "}
          <Link href="/budgets" className="font-semibold text-brand-600 hover:text-brand-700">
            Set a budget per category
          </Link>{" "}
          to see how this month is tracking.
        </p>
      </Card>
    );
  }

  const rows = progress.slice(0, MAX_ROWS);
  const hidden = progress.length - rows.length;

  return (
    <Card title="Budgets" subtitle="This month" action={manage}>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((p) => (
          <li key={p.category} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-800">
                <span aria-hidden>{CATEGORY_META[p.category].icon}</span>
                {p.category}
              </span>
              <BudgetStateLabel progress={p} />
            </div>
            <BudgetBar progress={p} size="sm" />
            <p className="text-xs tabular-nums text-slate-500">
              {formatCurrency(p.spent)} of {formatCurrency(p.limit)}
            </p>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          {hidden} more {hidden === 1 ? "budget" : "budgets"} on the{" "}
          <Link href="/budgets" className="font-semibold text-brand-600 hover:text-brand-700">
            Budgets page
          </Link>
          .
        </p>
      )}
    </Card>
  );
}
