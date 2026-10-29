import type { DescriptionFrequency } from "@/lib/insights";
import { formatCurrency } from "@/lib/format";

export function FrequentExpenses({ data }: { data: DescriptionFrequency[] }) {
  const repeats = data.filter((d) => d.count > 1);
  if (repeats.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-slate-500">
        Nothing repeats yet. Expenses with the same description will be grouped here.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-slate-100">
      {repeats.map((d, i) => (
        <li key={d.description.toLowerCase()} className="flex items-center gap-4 px-5 py-3 text-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">{d.description}</span>
            <span className="block text-xs text-slate-500">
              {d.count} times · about {formatCurrency(d.average)} each
            </span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(d.total)}</span>
        </li>
      ))}
    </ol>
  );
}
