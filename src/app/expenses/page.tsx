"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { EMPTY_FILTERS, type ExpenseFilters, type SortKey } from "@/lib/types";
import { filterExpenses, sortExpenses, sumAmounts } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { ExpenseFiltersBar } from "@/components/expenses/ExpenseFiltersBar";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { ExportDialog } from "@/components/export/ExportDialog";
import { SampleDataButton } from "@/components/SampleDataButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { DownloadIcon, ListIcon, PlusIcon, SearchIcon } from "@/components/ui/Icons";

const PAGE_SIZE = 50;

export default function ExpensesPage() {
  const { expenses, status } = useExpenses();
  const { openAdd } = useExpenseDialogs();
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [exportOpen, setExportOpen] = useState(false);
  const deferredSearch = useDeferredValue(filters.search);

  const sorted = useMemo(() => sortExpenses(expenses, sort), [expenses, sort]);
  const filtered = useMemo(
    () => sortExpenses(filterExpenses(expenses, { ...filters, search: deferredSearch }), sort),
    [expenses, filters, deferredSearch, sort],
  );
  const filteredTotal = useMemo(() => sumAmounts(filtered), [filtered]);
  const isFiltered = filters.search !== "" || filters.category !== "All" || filters.from !== "" || filters.to !== "";

  const handleFilters = (f: ExpenseFilters) => {
    setFilters(f);
    setVisible(PAGE_SIZE);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Search, filter, edit, and export your expenses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setExportOpen(true)} disabled={status !== "ready"}>
            <DownloadIcon className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={openAdd} disabled={status !== "ready"} className="sm:hidden">
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <Card bodyClassName="p-4 sm:p-5">
        <ExpenseFiltersBar filters={filters} onChange={handleFilters} sort={sort} onSortChange={setSort} />
      </Card>

      <Card bodyClassName="">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm text-slate-500" aria-live="polite">
            {status === "ready" ? (
              <>
                <span className="font-semibold text-slate-900">{filtered.length}</span>{" "}
                {isFiltered ? `of ${expenses.length} ` : ""}expense{filtered.length === 1 ? "" : "s"}
              </>
            ) : (
              "Loading…"
            )}
          </p>
          {status === "ready" && filtered.length > 0 && (
            <p className="text-sm text-slate-500">
              Total <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(filteredTotal)}</span>
            </p>
          )}
        </div>

        {status === "loading" && <ListSkeleton />}

        {status === "ready" && expenses.length === 0 && (
          <EmptyState
            icon={<ListIcon className="h-6 w-6" />}
            title="No expenses yet"
            description="Expenses you add will show up here."
            action={
              <>
                <Button onClick={openAdd}>
                  <PlusIcon className="h-4 w-4" />
                  Add expense
                </Button>
                <SampleDataButton />
              </>
            }
          />
        )}

        {status === "ready" && expenses.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={<SearchIcon className="h-6 w-6" />}
            title="No matching expenses"
            description="Try a different search term, category, or date range."
            action={
              <Button variant="secondary" onClick={() => handleFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        )}

        {status === "ready" && filtered.length > 0 && (
          <>
            <ExpenseList expenses={filtered.slice(0, visible)} />
            {filtered.length > visible && (
              <div className="border-t border-slate-100 p-3 text-center">
                <Button variant="ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Show more ({filtered.length - visible} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        expenses={sorted}
        filtered={isFiltered ? filtered : undefined}
      />
    </div>
  );
}
