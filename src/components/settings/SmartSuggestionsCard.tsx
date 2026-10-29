"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ML_FEEDBACK_KEY } from "@/lib/ml/contract";
import { readFeedback, summarizeFeedback, type AcceptanceStats, type FeedbackSummary } from "@/lib/ml/feedback";
import { getMlSettings, getServerMlSettings, resetLearning, setMlSettings, subscribeMlSettings } from "@/lib/ml/settings";
import { formatPercent } from "@/lib/format";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

/** How many recent suggestions the accuracy figure covers (plan 5.6). */
export const ACCURACY_WINDOW = 100;

export function SmartSuggestionsCard() {
  const settings = useSyncExternalStore(subscribeMlSettings, getMlSettings, getServerMlSettings);
  const { notify } = useToast();
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const labelId = useId();
  const descId = useId();

  const refresh = useCallback(() => setSummary(summarizeFeedback(readFeedback(), ACCURACY_WINDOW)), []);

  // The log is read after mount (it lives in localStorage), again after a reset, and when another tab writes it.
  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === ML_FEEDBACK_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh, settings.resetAt]);

  const confirmReset = () => {
    resetLearning();
    refresh();
    setConfirmOpen(false);
    notify("Learning reset. Your expenses and categories are unchanged.");
  };

  return (
    <Card title="Smart suggestions" subtitle="Suggests a category from the description as you add an expense." bodyClassName="divide-y divide-slate-100">
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p id={labelId} className="text-sm font-medium text-slate-900">
            Suggest categories
          </p>
          <p id={descId} className="mt-0.5 text-sm text-slate-500">
            {settings.enabled ? "On. Suggestions appear in the expense form." : "Off. You pick every category yourself."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-labelledby={labelId}
          aria-describedby={descId}
          onClick={() => setMlSettings({ enabled: !settings.enabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
            settings.enabled ? "bg-brand-600" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 transition-transform ${
              settings.enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-medium text-slate-900">Accuracy on this device</h3>
        <Accuracy summary={summary} enabled={settings.enabled} />
      </div>

      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-900">Reset learning</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Forget past suggestion outcomes and start fresh. Your expenses and their categories stay as they are.
          </p>
          {settings.resetAt && <p className="mt-1 text-xs text-slate-400">Last reset {formatResetAt(settings.resetAt)}</p>}
        </div>
        <Button variant="secondary" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setConfirmOpen(true)}>
          Reset learning
        </Button>
      </div>

      <p className="rounded-b-2xl bg-slate-50/80 px-5 py-3 text-xs text-slate-500">Everything runs on this device. Nothing is sent anywhere.</p>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Reset learning?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} data-autofocus>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReset}>
              Reset learning
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          This clears the suggestion history behind the accuracy figure and stops past suggestions from shaping new ones. Suggestions keep learning from the
          categories you&apos;ve saved. No expenses are deleted.
        </p>
      </Modal>
    </Card>
  );
}

function Accuracy({ summary, enabled }: { summary: FeedbackSummary | null; enabled: boolean }) {
  if (!summary) return <Skeleton className="mt-3 h-12 w-48" />;
  if (summary.rate === null) {
    return (
      <p className="mt-1 text-sm text-slate-500">
        {enabled
          ? "No suggestions yet. Accuracy shows up here after you save a few expenses with a suggestion on screen."
          : "No suggestions yet. Turn suggestions on and accuracy shows up here after you save a few expenses."}
      </p>
    );
  }
  return (
    <div className="mt-3">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-slate-900">{formatPercent(summary.rate)}</span>
        <span className="text-sm text-slate-500">
          accepted over the last {summary.shown} suggestion{summary.shown === 1 ? "" : "s"}
        </span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Split label="Pre-selected" stats={summary.preselected} />
        <Split label="Chips" stats={summary.chips} />
      </dl>
    </div>
  );
}

function Split({ label, stats }: { label: string; stats: AcceptanceStats }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-900">
        {stats.rate === null ? (
          <span className="font-normal text-slate-400">None yet</span>
        ) : (
          <>
            {formatPercent(stats.rate)} <span className="font-normal text-slate-500">({stats.accepted} of {stats.shown})</span>
          </>
        )}
      </dd>
    </div>
  );
}

function formatResetAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
