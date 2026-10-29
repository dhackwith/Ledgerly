import type { VendorTotal } from "@/lib/topVendors";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

/** Ranked vendors, highest total first; the rank is the row position. */
export function VendorTable({ vendors }: { vendors: VendorTotal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="w-12 py-3 pl-5 pr-2 font-medium">
              <span className="sr-only">Rank</span>#
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Vendor
            </th>
            <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">
              Category
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
          {vendors.map((v, i) => (
            <tr key={v.key}>
              <td className="py-3 pl-5 pr-2 align-top">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600">
                  {i + 1}
                </span>
              </td>
              <th scope="row" className="px-3 py-3 text-left align-top font-medium">
                <span className={`block max-w-[16rem] truncate ${v.unspecified ? "italic text-slate-500" : "text-slate-900"}`} title={v.name}>
                  {v.name}
                </span>
                {/* Share of the period total, as a bar plus the percent in text. */}
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="block h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(v.share * 100, v.share > 0 ? 2 : 0)}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-xs font-normal tabular-nums text-slate-500">
                    {formatPercent(v.share)}
                    <span className="sr-only"> of period spending</span>
                  </span>
                </span>
                {/* Category and count move under the name on small screens. */}
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-normal text-slate-500 md:hidden">
                  <CategoryBadge category={v.topCategory} />
                  <span className="sm:hidden">
                    {v.count} {v.count === 1 ? "expense" : "expenses"}
                  </span>
                </span>
              </th>
              <td className="hidden px-3 py-3 align-top md:table-cell">
                <CategoryBadge category={v.topCategory} />
              </td>
              <td className="hidden px-3 py-3 text-right align-top tabular-nums text-slate-600 sm:table-cell">{v.count}</td>
              <td className="px-5 py-3 text-right align-top font-semibold tabular-nums text-slate-900">{formatCurrency(v.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
