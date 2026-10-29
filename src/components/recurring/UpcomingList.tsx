import type { UpcomingOccurrence } from "@/lib/recurring";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  items: UpcomingOccurrence[];
}

export function UpcomingList({ items }: Props) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const meta = CATEGORY_META[item.category];
        return (
          <li key={`${item.ruleId}-${item.date}`} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
              style={{ backgroundColor: `${meta.color}1a` }}
              aria-hidden
            >
              {meta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{item.description}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <time dateTime={item.date}>{formatDate(item.date)}</time> · {item.category}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(item.amount)}</p>
          </li>
        );
      })}
    </ul>
  );
}
