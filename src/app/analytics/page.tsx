"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  categoryMonthOverMonth,
  generateInsights,
  monthlyByCategory,
  rollingDailyAverage,
  topDescriptions,
  weekdayAverages,
} from "@/lib/insights";
import { formatMonthKey, toISODate } from "@/lib/format";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { SampleDataButton } from "@/components/SampleDataButton";
import { PeriodSelector, type Period } from "@/components/analytics/PeriodSelector";
import { InsightsList } from "@/components/analytics/InsightsList";
import { StackedMonthlyChart } from "@/components/analytics/StackedMonthlyChart";
import { DailyTrendChart } from "@/components/analytics/DailyTrendChart";
import { WeekdayChart } from "@/components/analytics/WeekdayChart";
import { CategoryChangeTable } from "@/components/analytics/CategoryChangeTable";
import { FrequentExpenses } from "@/components/analytics/FrequentExpenses";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnalyticsIcon, LightbulbIcon, PlusIcon } from "@/components/ui/Icons";

const ROLLING_WINDOW = 7;

export default function AnalyticsPage() {
  const { expenses, status } = useExpenses();
  const { openAdd } = useExpenseDialogs();
  const [months, setMonths] = useState<Period>(6);
  const dailyDays = months === 3 ? 30 : 90;

  const data = useMemo(() => {
    const now = new Date();
    const periodStart = toISODate(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
    const inPeriod = expenses.filter((e) => e.date >= periodStart);
    const thisKey = toISODate(now).slice(0, 7);
    const lastKey = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    return {
      insights: generateInsights(expenses, now),
      monthly: monthlyByCategory(expenses, months, now),
      daily: rollingDailyAverage(expenses, dailyDays, ROLLING_WINDOW, now),
      weekdays: weekdayAverages(expenses, now, months),
      changes: categoryMonthOverMonth(expenses, now),
      frequent: topDescriptions(inPeriod, 6),
      periodLabel: `Last ${months} months`,
      thisMonthLabel: formatMonthKey(thisKey),
      lastMonthLabel: formatMonthKey(lastKey),
    };
  }, [expenses, months, dailyDays]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Trends, comparisons and patterns in your spending.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Insights is in the desktop nav; the mobile tab bar has no room, so link it from here. */}
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 sm:hidden"
          >
            <LightbulbIcon className="h-4 w-4" />
            Monthly insights
          </Link>
          <PeriodSelector value={months} onChange={setMonths} />
        </div>
      </div>

      {status === "loading" && (
        <div className="space-y-6" role="status" aria-label="Loading analytics">
          <Skeleton className="h-40" />
          <div className="grid gap-6 lg:grid-cols-5">
            <Skeleton className="h-80 lg:col-span-3" />
            <Skeleton className="h-80 lg:col-span-2" />
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            <Skeleton className="h-80 lg:col-span-3" />
            <Skeleton className="h-80 lg:col-span-2" />
          </div>
        </div>
      )}

      {status === "ready" && expenses.length === 0 && (
        <Card>
          <EmptyState
            icon={<AnalyticsIcon className="h-6 w-6" />}
            title="Nothing to analyze yet"
            description="Add a few expenses to see trends, comparisons and insights, or load some sample data to explore."
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
          <Card title="Insights" subtitle="What stands out in your recent spending">
            <InsightsList insights={data.insights} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Spending by category" subtitle={`${data.periodLabel}, stacked per month`} className="lg:col-span-3">
              <StackedMonthlyChart data={data.monthly} months={months} />
            </Card>
            <Card
              title="This month vs last month"
              subtitle={`${data.lastMonthLabel} compared with ${data.thisMonthLabel} so far`}
              className="lg:col-span-2"
              bodyClassName=""
            >
              <CategoryChangeTable data={data.changes} thisMonthLabel={data.thisMonthLabel} lastMonthLabel={data.lastMonthLabel} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Daily spending" subtitle={`Last ${dailyDays} days with a ${ROLLING_WINDOW}-day rolling average`} className="lg:col-span-3">
              <DailyTrendChart data={data.daily} days={dailyDays} window={ROLLING_WINDOW} />
            </Card>
            <Card title="Spending by weekday" subtitle={`Average per day, ${data.periodLabel.toLowerCase()}`} className="lg:col-span-2">
              <WeekdayChart data={data.weekdays} periodLabel={data.periodLabel} />
            </Card>
          </div>

          <Card title="Frequent expenses" subtitle={`Most repeated descriptions, ${data.periodLabel.toLowerCase()}`} bodyClassName="">
            <FrequentExpenses data={data.frequent} />
          </Card>
        </>
      )}
    </div>
  );
}
