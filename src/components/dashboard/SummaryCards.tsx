import type { ReactNode } from "react";
import type { DashboardStats } from "@/lib/analytics";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CATEGORY_META } from "@/lib/categories";
import { CalendarIcon, TagIcon, TrendUpIcon, WalletIcon } from "@/components/ui/Icons";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  footer?: ReactNode;
}

function StatCard({ label, value, icon, footer }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</p>
      {footer && <div className="mt-2 text-xs text-slate-500">{footer}</div>}
    </div>
  );
}

function ChangePill({ change }: { change: number | null }) {
  if (change === null) return <span>No spending recorded last month</span>;
  const up = change > 0;
  const flat = Math.abs(change) < 0.005;
  // Spending more is "bad", so up = red, down = green. Arrow + words keep it readable without color.
  const tone = flat ? "bg-slate-100 text-slate-600" : up ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full px-1.5 py-0.5 font-semibold ${tone}`}>
        {flat ? "±0%" : `${up ? "▲" : "▼"} ${formatPercent(Math.abs(change))}`}
      </span>
      {flat ? "same as" : up ? "more than" : "less than"} last month
    </span>
  );
}

export function SummaryCards({ stats }: { stats: DashboardStats }) {
  const top = stats.topCategory;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="This month"
        value={formatCurrency(stats.thisMonth)}
        icon={<CalendarIcon className="h-5 w-5" />}
        footer={<ChangePill change={stats.monthChange} />}
      />
      <StatCard
        label="Total spending"
        value={formatCurrency(stats.total)}
        icon={<WalletIcon className="h-5 w-5" />}
        footer={`${stats.count} expense${stats.count === 1 ? "" : "s"} recorded`}
      />
      <StatCard
        label="Daily average"
        value={formatCurrency(stats.avgPerDayThisMonth)}
        icon={<TrendUpIcon className="h-5 w-5" />}
        footer={`Across ${stats.thisMonthCount} expense${stats.thisMonthCount === 1 ? "" : "s"} this month`}
      />
      <StatCard
        label="Top category"
        value={top ? `${CATEGORY_META[top.category].icon} ${top.category}` : "—"}
        icon={<TagIcon className="h-5 w-5" />}
        footer={
          top
            ? `${formatCurrency(top.total)} · ${formatPercent(top.share)} of ${stats.topCategoryIsThisMonth ? "this month" : "all time"}`
            : "Add an expense to see this"
        }
      />
    </div>
  );
}
