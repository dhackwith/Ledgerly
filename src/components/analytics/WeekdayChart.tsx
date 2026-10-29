"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import type { WeekdayAverage } from "@/lib/insights";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { AXIS_TEXT, GRID, SERIES, TooltipBox } from "@/components/dashboard/Charts";

const MUTED = "#bfd1ff";

export function WeekdayChart({ data, periodLabel }: { data: WeekdayAverage[]; periodLabel: string }) {
  const max = Math.max(0, ...data.map((d) => d.average));
  const top = max > 0 ? data.reduce((best, d) => (d.average > best.average ? d : best), data[0]) : null;
  const spent = data.filter((d) => d.average > 0);
  const low = spent.length > 1 ? spent.reduce((best, d) => (d.average < best.average ? d : best), spent[0]) : null;

  return (
    <div className="space-y-3">
      <div className="h-64 w-full" role="img" aria-label={`Bar chart of average spending per weekday, ${periodLabel.toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="weekday" tick={{ fill: AXIS_TEXT, fontSize: 12 }} axisLine={false} tickLine={false} />
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
              content={({ active, payload }: TooltipProps<number, string>) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as WeekdayAverage;
                return (
                  <TooltipBox
                    title={`${d.name} average`}
                    value={formatCurrency(d.average)}
                    sub={`${formatCurrency(d.total)} over ${d.days} ${d.name}${d.days === 1 ? "" : "s"}`}
                  />
                );
              }}
            />
            <Bar dataKey="average" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((d) => (
                <Cell key={d.weekday} fill={top && d.index === top.index ? SERIES : MUTED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* The highlighted bar is also named here, so the comparison does not rely on colour. */}
      <p className="text-xs text-slate-500">
        {top ? (
          <>
            Highest: <span className="font-semibold text-slate-700">{top.name}</span> at {formatCurrency(top.average)} a day
            {low && low.index !== top.index ? (
              <>
                {" "}
                · Lowest: <span className="font-semibold text-slate-700">{low.name}</span> at {formatCurrency(low.average)}
              </>
            ) : null}
            .
          </>
        ) : (
          "No spending in this period."
        )}
      </p>
    </div>
  );
}
