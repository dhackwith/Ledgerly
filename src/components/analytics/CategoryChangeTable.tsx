import type { CategoryChange } from "@/lib/insights";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CategoryDot } from "@/components/ui/CategoryBadge";

/** Arrow + percent (or a word) so the direction never depends on colour alone. More spending is red. */
function ChangePill({ row }: { row: CategoryChange }) {
  const flat = Math.abs(row.change) < 0.005;
  if (flat) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">±0%</span>;
  if (row.percent === null) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">New</span>;
  }
  const up = row.change > 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${up ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "up" : "down"}</span> {formatPercent(Math.abs(row.percent))}
    </span>
  );
}

function signed(value: number): string {
  if (Math.abs(value) < 0.005) return formatCurrency(0);
  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

export function CategoryChangeTable({ data, thisMonthLabel, lastMonthLabel }: { data: CategoryChange[]; thisMonthLabel: string; lastMonthLabel: string }) {
  if (data.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-slate-500">No spending this month or last month yet.</p>;
  }
  const max = Math.max(...data.flatMap((d) => [d.thisMonth, d.lastMonth]), 0.01);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-5 py-3 font-medium">
              Category
            </th>
            <th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">
              {lastMonthLabel}
            </th>
            <th scope="col" className="px-3 py-3 text-right font-medium">
              {thisMonthLabel}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Change
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr key={row.category}>
              <th scope="row" className="px-5 py-3 text-left font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <CategoryDot category={row.category} />
                  {row.category}
                </span>
                {/* Two mini bars: this month in the category colour over last month in grey. */}
                <span className="mt-1.5 block w-full max-w-[9rem] space-y-0.5" aria-hidden>
                  <span className="block h-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max((row.thisMonth / max) * 100, row.thisMonth > 0 ? 2 : 0)}%`, backgroundColor: CATEGORY_META[row.category].color }}
                    />
                  </span>
                  <span className="block h-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-slate-300"
                      style={{ width: `${Math.max((row.lastMonth / max) * 100, row.lastMonth > 0 ? 2 : 0)}%` }}
                    />
                  </span>
                </span>
              </th>
              <td className="hidden px-3 py-3 text-right tabular-nums text-slate-500 sm:table-cell">{formatCurrency(row.lastMonth)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(row.thisMonth)}</td>
              <td className="px-5 py-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <ChangePill row={row} />
                  <span className="text-xs tabular-nums text-slate-500">{signed(row.change)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
