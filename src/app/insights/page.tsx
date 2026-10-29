"use client";

import { useMemo } from "react";
import { budgetStreak } from "@/lib/budgets";
import { monthSnapshot } from "@/lib/insights";
import { toISODate } from "@/lib/format";
import { useBudgets } from "@/components/providers/BudgetProvider";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { MonthlyInsights } from "@/components/insights/MonthlyInsights";
import { SampleDataButton } from "@/components/SampleDataButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { LightbulbIcon, PlusIcon } from "@/components/ui/Icons";

export default function InsightsPage() {
  const { expenses, status } = useExpenses();
  const { limits, status: budgetsStatus } = useBudgets();
  const { openAdd } = useExpenseDialogs();

  const data = useMemo(() => {
    const now = new Date();
    return {
      snapshot: monthSnapshot(expenses, now),
      streak: budgetStreak(expenses, limits, now),
      restartsOn: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    };
  }, [expenses, limits]);

  return (
    <div className="space-y-6">
      {status === "loading" && (
        <div className="mx-auto max-w-xl space-y-4" role="status" aria-label="Loading insights">
          <Skeleton className="h-16" />
          <Skeleton className="h-96" />
        </div>
      )}

      {status === "ready" && expenses.length === 0 && (
        <Card className="mx-auto max-w-xl">
          <EmptyState
            icon={<LightbulbIcon className="h-6 w-6" />}
            title="No insights yet"
            description="Add your first expense to see this month's breakdown and budget streak, or load some sample data to explore."
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

      {status === "ready" && expenses.length > 0 && (
        <MonthlyInsights snapshot={data.snapshot} streak={data.streak} budgetsStatus={budgetsStatus} restartsOn={data.restartsOn} />
      )}
    </div>
  );
}
