"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from "recharts";
import type { CategoryTotal } from "@/lib/analytics";
import type { BudgetStreak } from "@/lib/budgets";
import type { MonthSnapshot } from "@/lib/insights";
import { CATEGORY_META } from "@/lib/categories";
import { formatCompactCurrency, formatCurrency, formatMonthKey, formatPercent, formatShortDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";

export interface MonthlyInsightsProps {
  snapshot: MonthSnapshot;
  /** `null` when no budget limits are set. */
  streak: BudgetStreak | null;
  budgetsStatus: "loading" | "ready" | "error";
  /** YYYY-MM-DD of the first day of next month, when month-to-date budgets reset. */
  restartsOn: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function SpendingDonut({ data, total }: { data: CategoryTotal[]; total: number }) {
  return (
    <div className="relative mx-auto h-52 w-52" role="img" aria-label="Donut chart of this month's spending by category">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 1 : 0}
            stroke="#ffffff"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.category} fill={CATEGORY_META[d.category].color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: TooltipProps<number, string>) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as CategoryTotal;
              return (
                <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
                  <p className="font-medium text-slate-500">{d.category}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(d.total)}</p>
                  <p className="mt-0.5 text-slate-500">{formatPercent(d.share)} of this month</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-medium text-slate-500">Spending</span>
        <span className="text-lg font-semibold tabular-nums text-slate-900">
          {total < 10000 ? formatCurrency(total) : formatCompactCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function TopCategories({ data }: { data: CategoryTotal[] }) {
  return (
    <section aria-labelledby="top-categories-heading">
      <h2 id="top-categories-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {data.length === 3 ? "Top 3 categories" : "Top categories"}
      </h2>
      <ol className="mt-3 space-y-2">
        {data.map((d) => {
          const meta = CATEGORY_META[d.category];
          return (
            <li key={d.category} className="flex items-center gap-3 rounded-xl bg-slate-50 py-2.5 pl-2 pr-4 ring-1 ring-slate-200/60">
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
              <span className="text-lg leading-none" aria-hidden>
                {meta.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{d.category}</span>
              <span className="shrink-0 tabular-nums text-slate-900">
                <span className="font-semibold">{formatCurrency(d.total)}</span>
                <span className="ml-2 inline-block w-9 text-right text-xs text-slate-500">{formatPercent(d.share)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StreakBody({ streak, budgetsStatus, restartsOn }: Omit<MonthlyInsightsProps, "snapshot">) {
  if (budgetsStatus === "loading") return <Skeleton className="mx-auto mt-3 h-16 w-40" />;
  if (budgetsStatus === "error") {
    return <p className="mt-2 text-sm text-slate-500">Budgets couldn&apos;t be loaded, so the streak isn&apos;t available.</p>;
  }
  if (!streak) {
    return (
      <>
        <p className="mt-2 text-sm text-slate-500">Set a monthly budget for a category to start counting days without overspending.</p>
        <Link
          href="/budgets"
          className="mt-4 inline-flex items-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Set budgets
        </Link>
      </>
    );
  }

  const { current, longest, overToday } = streak;
  const best = Math.max(longest, current);
  return (
    <>
      <p className="mt-2">
        <span className={`block text-5xl font-bold tabular-nums ${current > 0 ? "text-emerald-600" : "text-slate-400"}`}>{current}</span>
        <span className="mt-1 block text-base font-medium text-slate-700">{current === 1 ? "day" : "days"}</span>
      </p>
      {overToday.length > 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {overToday.join(", ")} {overToday.length === 1 ? "is" : "are"} over budget this month. Your streak restarts on{" "}
          {formatShortDate(restartsOn)}.
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">In a row with every budgeted category under its monthly limit.</p>
      )}
      {best > 0 && (
        <div className="mx-auto mt-4 max-w-xs">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{current >= best ? "Your best streak yet" : "Toward your best"}</span>
            <span className="tabular-nums">Best: {plural(best, "day")}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Current streak compared with your best"
            aria-valuemin={0}
            aria-valuemax={best}
            aria-valuenow={current}
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(current / best) * 100}%` }} />
          </div>
        </div>
      )}
    </>
  );
}

/** The Monthly Insights screen body: this month's spending donut, top categories and budget streak. */
export function MonthlyInsights({ snapshot, streak, budgetsStatus, restartsOn }: MonthlyInsightsProps) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70" aria-labelledby="monthly-insights-heading">
      <header className="border-b border-slate-100 px-5 py-4 text-center">
        <h1 id="monthly-insights-heading" className="text-2xl font-semibold tracking-tight text-slate-900">
          Monthly Insights
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{formatMonthKey(snapshot.month, "long")}</p>
      </header>

      <div className="space-y-8 p-5 sm:p-6">
        {snapshot.total > 0 ? (
          <>
            <SpendingDonut data={snapshot.categories} total={snapshot.total} />
            <TopCategories data={snapshot.top} />
          </>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200/60">
            No spending recorded yet this month. Add an expense to see your breakdown.
          </p>
        )}

        <section
          aria-labelledby="budget-streak-heading"
          className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-6 text-center"
        >
          <h2 id="budget-streak-heading" className="text-base font-semibold text-slate-900">
            Budget streak
          </h2>
          <StreakBody streak={streak} budgetsStatus={budgetsStatus} restartsOn={restartsOn} />
        </section>
      </div>
    </section>
  );
}
