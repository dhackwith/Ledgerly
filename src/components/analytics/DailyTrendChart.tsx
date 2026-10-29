"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import type { RollingDayPoint } from "@/lib/insights";
import { formatCompactCurrency, formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import { AXIS_TEXT, GRID, SERIES, TooltipBox } from "@/components/dashboard/Charts";

const DAILY = "#94a3b8";

export function DailyTrendChart({ data, days, window }: { data: RollingDayPoint[]; days: number; window: number }) {
  const max = Math.max(0, ...data.map((d) => d.total));
  return (
    <div className="space-y-3">
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Line chart of daily spending for the last ${days} days with a ${window}-day rolling average`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
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
              domain={[0, max > 0 ? "auto" : 100]}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1" }}
              content={({ active, payload }: TooltipProps<number, string>) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as RollingDayPoint;
                return (
                  <TooltipBox
                    title={formatDate(p.date)}
                    value={p.total > 0 ? formatCurrency(p.total) : "No spending"}
                    sub={`${window}-day average: ${formatCurrency(p.average)}`}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="total" name="Daily" stroke={DAILY} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
            <Line type="monotone" dataKey="average" name="Rolling average" stroke={SERIES} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: DAILY }} aria-hidden />
          Daily total (thin line)
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-[3px] w-5 rounded" style={{ backgroundColor: SERIES }} aria-hidden />
          {window}-day rolling average (bold line)
        </li>
      </ul>
    </div>
  );
}
