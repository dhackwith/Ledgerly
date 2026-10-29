"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { CATEGORIES, type Category } from "@/lib/types";
import type { MonthCategoryTotals } from "@/lib/insights";
import { CATEGORY_META } from "@/lib/categories";
import { formatCompactCurrency, formatCurrency, formatMonthKey, formatPercent } from "@/lib/format";
import { AXIS_TEXT, GRID } from "@/components/dashboard/Charts";
import { CategoryDot } from "@/components/ui/CategoryBadge";

type StackedRow = Record<Category, number> & { month: string; total: number };

function MonthTooltip({ row }: { row: StackedRow }) {
  const rows = CATEGORIES.filter((c) => row[c] > 0);
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      <p className="font-medium text-slate-500">{formatMonthKey(row.month, "long")}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(row.total)}</p>
      {rows.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {rows.map((c) => (
            <li key={c} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600">
                <CategoryDot category={c} />
                {c}
              </span>
              <span className="tabular-nums text-slate-900">{formatCurrency(row[c])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StackedMonthlyChart({ data, months }: { data: MonthCategoryTotals[]; months: number }) {
  const rows: StackedRow[] = data.map((m) => ({ month: m.month, total: m.total, ...m.byCategory }));
  const max = Math.max(0, ...data.map((d) => d.total));
  const grandCents = data.reduce((acc, m) => acc + Math.round(m.total * 100), 0);
  const legend = CATEGORIES.map((category) => {
    const cents = data.reduce((acc, m) => acc + Math.round(m.byCategory[category] * 100), 0);
    return { category, total: cents / 100, share: grandCents > 0 ? cents / grandCents : 0 };
  }).filter((l) => l.total > 0);

  return (
    <div className="space-y-5">
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Stacked bar chart of monthly spending by category for the last ${months} months`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => formatMonthKey(m)}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval={months > 6 ? 1 : 0}
            />
            <YAxis
              tickFormatter={(v: number) => formatCompactCurrency(v)}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
              domain={[0, max > 0 ? "auto" : 100]}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              content={({ active, payload }: TooltipProps<number, string>) =>
                active && payload?.length ? <MonthTooltip row={payload[0].payload as StackedRow} /> : null
              }
            />
            {CATEGORIES.map((category) => (
              <Bar key={category} dataKey={category} stackId="month" fill={CATEGORY_META[category].color} maxBarSize={40} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend doubles as a data table: period totals and share per category. */}
      {legend.length > 0 && (
        <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2" aria-label="Category totals for the period">
          {legend.map((l) => (
            <li key={l.category} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <CategoryDot category={l.category} />
                <span className="truncate">{l.category}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-900">
                <span className="font-semibold">{formatCurrency(l.total)}</span>
                <span className="ml-2 inline-block w-9 text-right text-xs text-slate-500">{formatPercent(l.share)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
