"use client";

import { CATEGORIES, EMPTY_FILTERS, type ExpenseFilters, type SortKey } from "@/lib/types";
import { toISODate, todayISO } from "@/lib/format";
import { SearchIcon, XIcon } from "@/components/ui/Icons";

interface Props {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}

const control =
  "block w-full rounded-lg border-0 bg-white py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600";

type Preset = { label: string; range: () => { from: string; to: string } };

const PRESETS: Preset[] = [
  {
    label: "This month",
    range: () => {
      const n = new Date();
      return { from: toISODate(new Date(n.getFullYear(), n.getMonth(), 1)), to: todayISO() };
    },
  },
  {
    label: "Last month",
    range: () => {
      const n = new Date();
      return {
        from: toISODate(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        to: toISODate(new Date(n.getFullYear(), n.getMonth(), 0)),
      };
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const n = new Date();
      return { from: toISODate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), to: todayISO() };
    },
  },
  {
    label: "This year",
    range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() }),
  },
];

export function ExpenseFiltersBar({ filters, onChange, sort, onSortChange }: Props) {
  const set = <K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) => onChange({ ...filters, [key]: value });
  const active =
    filters.search !== "" || filters.category !== "All" || filters.from !== "" || filters.to !== "";
  const rangeInvalid = filters.from && filters.to && filters.from > filters.to;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <label htmlFor="filter-search" className="sr-only">
            Search expenses
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="filter-search"
            type="search"
            placeholder="Search descriptions…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className={`${control} pl-9 pr-3`}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="filter-category" className="sr-only">
            Category
          </label>
          <select
            id="filter-category"
            value={filters.category}
            onChange={(e) => set("category", e.target.value as ExpenseFilters["category"])}
            className={`${control} pl-3 pr-8`}
          >
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 md:col-span-4">
          <div>
            <label htmlFor="filter-from" className="sr-only">
              From date
            </label>
            <input
              id="filter-from"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set("from", e.target.value)}
              className={`${control} px-3 ${rangeInvalid ? "ring-red-300" : ""}`}
              aria-label="From date"
            />
          </div>
          <div>
            <label htmlFor="filter-to" className="sr-only">
              To date
            </label>
            <input
              id="filter-to"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set("to", e.target.value)}
              className={`${control} px-3 ${rangeInvalid ? "ring-red-300" : ""}`}
              aria-label="To date"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className={`${control} pl-3 pr-8`}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const r = p.range();
          const selected = filters.from === r.from && filters.to === r.to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ ...filters, ...(selected ? { from: "", to: "" } : r) })}
              aria-pressed={selected}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                selected ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <XIcon className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
        {rangeInvalid && <span className="text-xs text-red-600">Start date is after end date.</span>}
      </div>
    </div>
  );
}
