"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeStats, sortExpenses, sumAmounts, totalsByCategory, totalsByDay, totalsByMonth } from "@/lib/analytics";
import { formatMonthKey, monthKey, todayISO } from "@/lib/format";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { BudgetAlertBanner, BudgetsCard } from "@/components/dashboard/BudgetsCard";
import { CategoryDonut, DailyBarChart, MonthlyBarChart } from "@/components/dashboard/Charts";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { ExportDialog } from "@/components/export/ExportDialog";
import { UpcomingRecurringCard } from "@/components/recurring/UpcomingRecurringCard";
import { SampleDataButton } from "@/components/SampleDataButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeletonGrid, ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { ChartIcon, DownloadIcon, PlusIcon } from "@/components/ui/Icons";

export default function DashboardPage() {
  const { expenses, status } = useExpenses();
  const { openAdd } = useExpenseDialogs();
  const [exportOpen, setExportOpen] = useState(false);

  const data = useMemo(() => {
    const thisMonth = expenses.filter((e) => monthKey(e.date) === monthKey(todayISO()));
    const byDate = sortExpenses(expenses, "date-desc");
    return {
      stats: computeStats(expenses),
      monthly: totalsByMonth(expenses, 6),
      daily: totalsByDay(expenses, 30),
      categories: totalsByCategory(thisMonth.length ? thisMonth : expenses),
      categoriesTotal: sumAmounts(thisMonth.length ? thisMonth : expenses),
      categoriesScope: thisMonth.length ? formatMonthKey(monthKey(todayISO()), "long") : "All time",
      recent: byDate.slice(0, 6),
      byDate,
    };
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">An overview of where your money is going.</p>
        </div>
        <Button variant="secondary" onClick={() => setExportOpen(true)} disabled={status !== "ready"} className="self-start sm:self-auto">
          <DownloadIcon className="h-4 w-4" />
          Export
        </Button>
      </div>

      <BudgetAlertBanner />

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

          <BudgetsCard />

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

          <UpcomingRecurringCard />
        </>
      )}

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} expenses={data.byDate} />
    </div>
  );
}
