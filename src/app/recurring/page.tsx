"use client";

import { useCallback, useMemo, useState } from "react";
import type { RecurringRule } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import type { RecurringRuleData } from "@/lib/recurring";
import { useRecurring } from "@/components/providers/RecurringProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { RecurringRuleForm } from "@/components/recurring/RecurringRuleForm";
import { RecurringRuleList } from "@/components/recurring/RecurringRuleList";
import { UpcomingList } from "@/components/recurring/UpcomingList";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PlusIcon, RepeatIcon } from "@/components/ui/Icons";

const UPCOMING_LIMIT = 8;

type DialogState = { kind: "closed" } | { kind: "add" } | { kind: "edit"; rule: RecurringRule } | { kind: "delete"; rule: RecurringRule };

export default function RecurringPage() {
  const { rules, status, addRule, updateRule, deleteRule, toggleRule, upcoming } = useRecurring();
  const { notify } = useToast();
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  // Bumped on every open so the form remounts with fresh values.
  const [formKey, setFormKey] = useState(0);

  const close = useCallback(() => setDialog({ kind: "closed" }), []);

  const openAdd = () => {
    setFormKey((k) => k + 1);
    setDialog({ kind: "add" });
  };

  const openEdit = (rule: RecurringRule) => {
    setFormKey((k) => k + 1);
    setDialog({ kind: "edit", rule });
  };

  const handleSubmit = (data: RecurringRuleData) => {
    if (dialog.kind === "edit") {
      updateRule(dialog.rule.id, data);
      notify("Recurring rule updated");
    } else {
      addRule(data);
      notify(`Added recurring rule for ${data.description}`);
    }
    close();
  };

  const handleDelete = () => {
    if (dialog.kind !== "delete") return;
    deleteRule(dialog.rule.id);
    close();
    notify("Recurring rule deleted. Existing expenses were kept.", { variant: "info" });
  };

  const handleToggle = (rule: RecurringRule) => {
    toggleRule(rule.id);
    notify(rule.active ? `Paused ${rule.description}` : `Resumed ${rule.description}`, { variant: "info" });
  };

  const upcomingItems = useMemo(() => upcoming(UPCOMING_LIMIT), [upcoming]);
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recurring</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule expenses that repeat, like rent or subscriptions.</p>
        </div>
        <Button onClick={openAdd} disabled={status !== "ready"}>
          <PlusIcon className="h-4 w-4" />
          Add rule
        </Button>
      </div>

      {status === "error" && (
        <div className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-200" role="alert">
          <h2 className="text-sm font-semibold text-red-800">We couldn&apos;t load your recurring rules</h2>
          <p className="mt-1 text-sm text-red-700">Browser storage is unavailable or the saved data is corrupted.</p>
        </div>
      )}

      {status === "loading" && (
        <Card bodyClassName="">
          <ListSkeleton rows={3} />
        </Card>
      )}

      {status === "ready" && rules.length === 0 && (
        <Card>
          <EmptyState
            icon={<RepeatIcon className="h-6 w-6" />}
            title="No recurring expenses"
            description="Add your first recurring expense and Ledgerly will record it automatically on schedule."
            action={
              <Button onClick={openAdd}>
                <PlusIcon className="h-4 w-4" />
                Add your first recurring expense
              </Button>
            }
          />
        </Card>
      )}

      {status === "ready" && rules.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card
            title="Rules"
            subtitle={`${activeCount} active of ${rules.length}`}
            className="lg:col-span-3"
            bodyClassName=""
          >
            <RecurringRuleList rules={rules} onEdit={openEdit} onDelete={(rule) => setDialog({ kind: "delete", rule })} onToggle={handleToggle} />
          </Card>

          <Card title="Upcoming" subtitle={`Next ${UPCOMING_LIMIT} occurrences`} className="lg:col-span-2" bodyClassName="">
            {upcomingItems.length ? (
              <UpcomingList items={upcomingItems} />
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing scheduled. Resume a rule or add a new one.</p>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={dialog.kind === "add" || dialog.kind === "edit"}
        onClose={close}
        title={dialog.kind === "edit" ? "Edit recurring rule" : "Add recurring rule"}
        description={
          dialog.kind === "edit"
            ? "Changes apply to future occurrences. Expenses already recorded stay as they are."
            : "Ledgerly will add an expense on each scheduled date."
        }
      >
        <RecurringRuleForm key={formKey} initial={dialog.kind === "edit" ? dialog.rule : undefined} onSubmit={handleSubmit} onCancel={close} />
      </Modal>

      <Modal open={dialog.kind === "delete"} onClose={close} title="Delete recurring rule?" size="sm">
        {dialog.kind === "delete" && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              This stops <span className="font-semibold text-slate-900">{dialog.rule.description}</span> ({formatCurrency(dialog.rule.amount)})
              from repeating. Expenses it already created will be kept.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={close} data-autofocus>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
