"use client";

import type { RecurringRule } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { describeRule } from "@/lib/recurring";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { PencilIcon, TrashIcon } from "@/components/ui/Icons";

interface Props {
  rules: RecurringRule[];
  onEdit: (rule: RecurringRule) => void;
  onDelete: (rule: RecurringRule) => void;
  onToggle: (rule: RecurringRule) => void;
}

function ended(rule: RecurringRule): boolean {
  return !!rule.endDate && rule.nextDate > rule.endDate;
}

export function RecurringRuleList({ rules, onEdit, onDelete, onToggle }: Props) {
  return (
    <ul className="divide-y divide-slate-100">
      {rules.map((rule) => {
        const meta = CATEGORY_META[rule.category];
        const done = ended(rule);
        const muted = !rule.active || done;
        return (
          <li
            key={rule.id}
            className={`group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 sm:gap-4 sm:px-5 ${muted ? "opacity-70" : ""}`}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${meta.color}1a` }}
              aria-hidden
            >
              {meta.icon}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{rule.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{describeRule(rule)}</span>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline">
                  <CategoryBadge category={rule.category} />
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {done ? (
                  "Finished"
                ) : rule.active ? (
                  <>
                    Next: <time dateTime={rule.nextDate}>{formatDate(rule.nextDate)}</time>
                  </>
                ) : (
                  "Paused"
                )}
              </p>
            </div>

            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(rule.amount)}</p>

            <button
              type="button"
              role="switch"
              aria-checked={rule.active}
              aria-label={`${rule.active ? "Pause" : "Resume"} ${rule.description}`}
              onClick={() => onToggle(rule)}
              disabled={done}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${
                rule.active ? "bg-brand-600" : "bg-slate-300"
              }`}
            >
              <span
                aria-hidden
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  rule.active ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>

            <div className="flex shrink-0 items-center gap-0.5 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => onEdit(rule)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-brand-600 hover:shadow-sm"
                aria-label={`Edit ${rule.description}`}
                title="Edit"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(rule)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-red-600 hover:shadow-sm"
                aria-label={`Delete ${rule.description}`}
                title="Delete"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
