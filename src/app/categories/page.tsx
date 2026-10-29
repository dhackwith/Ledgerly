"use client";

import { useMemo, useState } from "react";
import { TOP_CATEGORIES_PERIODS, topCategories, type DateRange, type TopCategoriesPeriod } from "@/lib/topCategories";
import { formatCurrency, formatDate } from "@/lib/format";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { SampleDataButton } from "@/components/SampleDataButton";
import { CategoryPeriodSelector } from "@/components/categories/CategoryPeriodSelector";
import { TopCategoriesTable } from "@/components/categories/TopCategoriesTable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlusIcon, TagIcon } from "@/components/ui/Icons";

function rangeLabel(range: DateRange): string {
  if (!range.from || !range.to) return "All recorded expenses";
  return `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

function PageSkeleton() {
  return (
    <div className="rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70" role="status" aria-label="Loading categories">
      <div className="border-b border-slate-100 px-5 py-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-48" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-2 flex-1" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { expenses, status } = useExpenses();
  const { openAdd } = useExpenseDialogs();
  const [period, setPeriod] = useState<TopCategoriesPeriod>("month");

  const result = useMemo(() => topCategories(expenses, period), [expenses, period]);
  const periodLabel = TOP_CATEGORIES_PERIODS.find((p) => p.value === period)?.label ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">Where your money goes, ranked by total spend.</p>
        </div>
        <CategoryPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {status === "loading" && <PageSkeleton />}

      {status === "ready" && expenses.length === 0 && (
        <Card>
          <EmptyState
            icon={<TagIcon className="h-6 w-6" />}
            title="No expenses yet"
            description="Add a few expenses to see which categories you spend the most on, or load some sample data to explore."
            action={
              <>
                <Button onClick={openAdd}>
                  <PlusIcon className="h-4 w-4" />
                  Add expense
                </Button>
                <SampleDataButton />
              </>
            }
          />
        </Card>
      )}

      {status === "ready" && expenses.length > 0 && result.rows.length === 0 && (
        <Card>
          <EmptyState
            icon={<TagIcon className="h-6 w-6" />}
            title={period === "all" ? "No spending to rank" : "Nothing spent in this period"}
            description={
              result.range.from && result.range.to
                ? `You have no expenses dated ${formatDate(result.range.from)} to ${formatDate(result.range.to)}. Try a longer period.`
                : "None of your saved expenses have a positive amount to rank."
            }
            action={
              period !== "all" ? (
                <Button variant="secondary" onClick={() => setPeriod("all")}>
                  Show all time
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {status === "ready" && result.rows.length > 0 && (
        <Card
          title={periodLabel}
          subtitle={rangeLabel(result.range)}
          action={
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Period total</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{formatCurrency(result.total)}</p>
            </div>
          }
          bodyClassName=""
        >
          <TopCategoriesTable rows={result.rows} total={result.total} count={result.count} />
          {result.unused.length > 0 && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              No spending in {result.unused.join(", ")} for this period.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
