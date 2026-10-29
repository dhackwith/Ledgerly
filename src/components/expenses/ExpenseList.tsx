"use client";

import type { Expense } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { PencilIcon, RepeatIcon, TrashIcon } from "@/components/ui/Icons";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";

interface Props {
  expenses: Expense[];
  compact?: boolean;
}

export function ExpenseList({ expenses, compact = false }: Props) {
  const { openEdit, confirmDelete } = useExpenseDialogs();

  return (
    <ul className="divide-y divide-slate-100">
      {expenses.map((e) => {
        const meta = CATEGORY_META[e.category];
        return (
          <li key={e.id} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 sm:gap-4 sm:px-5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${meta.color}1a` }}
              aria-hidden
            >
              {meta.icon}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{e.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <time dateTime={e.date}>{formatDate(e.date)}</time>
                {e.recurringId && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20"
                    title="Generated from a recurring rule"
                  >
                    <RepeatIcon className="h-3 w-3" />
                    Recurring
                  </span>
                )}
                {!compact && (
                  <>
                    <span aria-hidden className="hidden sm:inline">
                      ·
                    </span>
                    <span className="hidden sm:inline">
                      <CategoryBadge category={e.category} />
                    </span>
                  </>
                )}
                {compact && <span>· {e.category}</span>}
              </div>
            </div>

            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(e.amount)}</p>

            {!compact && (
              <div className="flex shrink-0 items-center gap-0.5 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(e)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-600 hover:shadow-sm"
                  aria-label={`Edit ${e.description}`}
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(e)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-red-600 hover:shadow-sm"
                  aria-label={`Delete ${e.description}`}
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
