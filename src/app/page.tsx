"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeStats, sortExpenses, sumAmounts, totalsByCategory, totalsByDay, totalsByMonth } from "@/lib/analytics";
import { formatMonthKey, monthKey, todayISO } from "@/lib/format";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { useCloud } from "@/components/cloud/CloudProvider";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CategoryDonut, DailyBarChart, MonthlyBarChart } from "@/components/dashboard/Charts";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { SampleDataButton } from "@/components/SampleDataButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeletonGrid, ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { ChartIcon, PlusIcon, ShareIcon } from "@/components/ui/Icons";

export default function DashboardPage() {
  const { expenses, status } = useExpenses();
  const { openAdd } = useExpenseDialogs();
  const { openComposer } = useCloud();

  const data = useMemo(() => {
    const thisMonth = expenses.filter((e) => monthKey(e.date) === monthKey(todayISO()));
    return {
      stats: computeStats(expenses),
      monthly: totalsByMonth(expenses, 6),
      daily: totalsByDay(expenses, 30),
      categories: totalsByCategory(thisMonth.length ? thisMonth : expenses),
      categoriesTotal: sumAmounts(thisMonth.length ? thisMonth : expenses),
      categoriesScope: thisMonth.length ? formatMonthKey(monthKey(todayISO()), "long") : "All time",
      recent: sortExpenses(expenses, "date-desc").slice(0, 6),
    };
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">An overview of where your money is going.</p>
        </div>
        <Button variant="secondary" onClick={() => openComposer({ template: "monthly-summary" })} disabled={status !== "ready" || expenses.length === 0}>
          <ShareIcon className="h-4 w-4" />
          Share report
        </Button>
      </div>

      {status === "loading" && (
        <>
          <CardSkeletonGrid />
          <div className="grid gap-6 lg:grid-cols-5">
            <Skeleton className="h-80 lg:col-span-3" />
            <Skeleton className="h-80 lg:col-span-2" />
          </div>
        </>
      )}

      {status === "ready" && expenses.length === 0 && (
        <Card>
          <EmptyState
            icon={<ChartIcon className="h-6 w-6" />}
            title="No expenses yet"
            description="Add your first expense to start seeing spending summaries and charts, or load some sample data to explore."
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

      {status === "ready" && expenses.length > 0 && (
        <>
          <SummaryCards stats={data.stats} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Monthly spending" subtitle="Last 6 months">
              <MonthlyBarChart data={data.monthly} />
            </Card>
            <Card title="By category" subtitle={data.categoriesScope}>
              <CategoryDonut data={data.categories} total={data.categoriesTotal} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Daily spending" subtitle="Last 30 days" className="lg:col-span-3">
              <DailyBarChart data={data.daily} />
            </Card>
            <Card
              title="Recent expenses"
              className="lg:col-span-2"
              bodyClassName=""
              action={
                <Link href="/expenses" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  View all
                </Link>
              }
            >
              {data.recent.length ? <ExpenseList expenses={data.recent} compact /> : <ListSkeleton rows={3} />}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
