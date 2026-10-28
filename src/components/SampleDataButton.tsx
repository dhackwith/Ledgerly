"use client";

import { buildSampleExpenses } from "@/lib/analytics";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { SparklesIcon } from "@/components/ui/Icons";

export function SampleDataButton() {
  const { addMany } = useExpenses();
  const { notify } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() => {
        const items = buildSampleExpenses();
        addMany(items);
        notify(`Loaded ${items.length} sample expenses`);
      }}
    >
      <SparklesIcon className="h-4 w-4" />
      Load sample data
    </Button>
  );
}
