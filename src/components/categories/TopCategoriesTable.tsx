import type { RankedCategory } from "@/lib/topCategories";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

/** Rounded percent, but never "0%" for a category that did have spend. */
function formatShare(share: number): string {
  return share > 0 && share < 0.005 ? "<1%" : formatPercent(share);
}

function expensesLabel(count: number): string {
  return `${count} ${count === 1 ? "expense" : "expenses"}`;
}

interface Props {
  rows: RankedCategory[];
  total: number;
  count: number;
}

export function TopCategoriesTable({ rows, total, count }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="w-12 py-3 pl-5 pr-2 font-medium">
              <span aria-hidden>#</span>
              <span className="sr-only">Rank</span>
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Category
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Share
            </th>
            <th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">
              Expenses
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.category}>
              <td className="py-3 pl-5 pr-2 tabular-nums">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {row.rank}
                </span>
              </td>
              <th scope="row" className="px-3 py-3 text-left font-normal">
                <CategoryBadge category={row.category} />
                <span className="mt-1 block text-xs text-slate-500 sm:hidden">{expensesLabel(row.count)}</span>
              </th>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  {/* Decorative: the percent next to it carries the value. */}
                  <span className="block h-2 min-w-[2.5rem] max-w-[10rem] flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(row.share * 100, 2)}%`, backgroundColor: CATEGORY_META[row.category].color }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-700">{formatShare(row.share)}</span>
                </div>
              </td>
              <td className="hidden px-3 py-3 text-right tabular-nums text-slate-500 sm:table-cell">{row.count}</td>
              <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/60">
            <th scope="row" colSpan={3} className="px-5 py-3 text-left font-semibold text-slate-700">
              Period total
              <span className="ml-2 text-xs font-normal text-slate-500 sm:hidden">{expensesLabel(count)}</span>
            </th>
            <td className="hidden px-3 py-3 text-right tabular-nums text-slate-500 sm:table-cell">{count}</td>
            <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
