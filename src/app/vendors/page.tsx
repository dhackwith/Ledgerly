"use client";

import { useMemo, useState } from "react";
import { periodRange, topVendors, vendorTotals, VENDOR_PERIODS, type VendorPeriod } from "@/lib/topVendors";
import { formatCurrency } from "@/lib/format";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { SampleDataButton } from "@/components/SampleDataButton";
import { VendorPeriodSelector } from "@/components/vendors/VendorPeriodSelector";
import { VendorTable } from "@/components/vendors/VendorTable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CalendarIcon, PlusIcon, TrendUpIcon } from "@/components/ui/Icons";

const TOP_N = 10;

/** Completes "No spending …" for each period. */
const PERIOD_PHRASE: Record<VendorPeriod, string> = {
  month: "this month",
  quarter: "in the last 3 months",
  year: "this year",
  all: "recorded yet",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function VendorsPage() {
  const { expenses, status } = useExpenses();
  const { openAdd } = useExpenseDialogs();
  const [period, setPeriod] = useState<VendorPeriod>("quarter");
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => vendorTotals(expenses, periodRange(period)), [expenses, period]);
  const shown = showAll ? summary.vendors : topVendors(summary.vendors, TOP_N);
  const periodLabel = VENDOR_PERIODS.find((p) => p.value === period)?.label ?? "";
  const hidden = summary.vendors.length - shown.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Top vendors</h1>
          <p className="text-sm text-slate-500">Where your money goes, ranked by total spend.</p>
        </div>
        <VendorPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {status === "loading" && (
        <div className="space-y-6" role="status" aria-label="Loading vendors">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      )}

      {status === "ready" && expenses.length === 0 && (
        <Card>
          <EmptyState
            icon={<TrendUpIcon className="h-6 w-6" />}
            title="No vendors yet"
            description="Vendors are taken from your expense descriptions. Add a few expenses, or load some sample data to explore."
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
        </Card>
      )}

      {status === "ready" && expenses.length > 0 && summary.count === 0 && (
        <Card>
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={`No spending ${PERIOD_PHRASE[period]}`}
            description="There are no expenses in this period. Pick a longer period to see your top vendors."
            action={
              period !== "all" ? (
                <Button variant="secondary" onClick={() => setPeriod("all")}>
                  Show all time
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {status === "ready" && summary.count > 0 && (
        <>
          <Card>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-500">Spent, {periodLabel.toLowerCase()}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{formatCurrency(summary.total)}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Vendors</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{summary.vendors.length}</dd>
              </div>
              <div className="hidden sm:block">
                <dt className="text-sm text-slate-500">Expenses</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{summary.count}</dd>
              </div>
            </dl>
          </Card>

          <Card
            title={showAll ? "All vendors" : `Top ${Math.min(TOP_N, summary.vendors.length)} vendors`}
            subtitle={`${periodLabel}, ranked by total spend`}
            bodyClassName=""
            action={
              summary.vendors.length > TOP_N ? (
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                  {showAll ? `Show top ${TOP_N}` : `Show all ${summary.vendors.length}`}
                </Button>
              ) : undefined
            }
          >
            <VendorTable vendors={shown} />
            {hidden > 0 && (
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                {plural(hidden, "more vendor")} not shown.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
