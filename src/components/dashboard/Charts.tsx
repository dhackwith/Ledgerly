"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { CategoryTotal, DayTotal, MonthTotal } from "@/lib/analytics";
import { CATEGORY_META } from "@/lib/categories";
import { formatCompactCurrency, formatCurrency, formatDate, formatMonthKey, formatPercent, formatShortDate } from "@/lib/format";
import { CategoryDot } from "@/components/ui/CategoryBadge";

const SERIES = "#2a78d6";
const GRID = "#e8ecf1";
const AXIS_TEXT = "#64748b";

function TooltipBox({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      <p className="font-medium text-slate-500">{title}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-slate-500">{sub}</p>}
    </div>
  );
}

export function MonthlyBarChart({ data }: { data: MonthTotal[] }) {
  const max = Math.max(...data.map((d) => d.total));
  return (
    <div className="h-64 w-full" role="img" aria-label="Bar chart of spending per month for the last six months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => formatMonthKey(m)}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
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
              active && payload?.length ? (
                <TooltipBox
                  title={formatMonthKey(String(payload[0].payload.month), "long")}
                  value={formatCurrency(Number(payload[0].value))}
                />
              ) : null
            }
          />
          <Bar dataKey="total" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyBarChart({ data }: { data: DayTotal[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Bar chart of daily spending for the last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatShortDate(d)}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload }: TooltipProps<number, string>) =>
              active && payload?.length ? (
                <TooltipBox
                  title={formatDate(String(payload[0].payload.date))}
                  value={Number(payload[0].value) > 0 ? formatCurrency(Number(payload[0].value)) : "No spending"}
                />
              ) : null
            }
          />
          <Bar dataKey="total" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonut({ data, total }: { data: CategoryTotal[]; total: number }) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-48 w-48 shrink-0" role="img" aria-label="Donut chart of spending share by category">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              innerRadius="64%"
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
                return <TooltipBox title={d.category} value={formatCurrency(d.total)} sub={`${formatPercent(d.share)} · ${d.count} items`} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-base font-semibold tabular-nums text-slate-900">
            {total < 10000 ? formatCurrency(total) : formatCompactCurrency(total)}
          </span>
        </div>
      </div>

      {/* Legend doubles as a data table, so identity never depends on color alone. */}
      <ul className="w-full space-y-3">
        {data.map((d) => (
          <li key={d.category}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <CategoryDot category={d.category} />
                <span className="truncate">{d.category}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-900">
                <span className="font-semibold">{formatCurrency(d.total)}</span>
                <span className="ml-2 inline-block w-9 text-right text-xs text-slate-500">{formatPercent(d.share)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(d.share * 100, 1)}%`, backgroundColor: CATEGORY_META[d.category].color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
