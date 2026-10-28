"use client";

import { useDeferredValue, useEffect, useMemo, useReducer, useRef, type KeyboardEvent } from "react";
import type { Expense } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { countByCategory, selectRows, summarize, validateOptions } from "@/lib/export/dataset";
import { FORMATS } from "@/lib/export/formats";
import { savePreferences } from "@/lib/export/preferences";
import { runExport, saveBlob } from "@/lib/export/run";
import type { ExportOptions, ExportResult } from "@/lib/export/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/providers/ToastProvider";
import { exportReducer, initExportState } from "./exportReducer";
import { ExportOptionsPanel } from "./ExportOptionsPanel";
import { ExportPreview } from "./ExportPreview";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  expenses: Expense[];
  initialOptions: ExportOptions;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

function ExportComplete({ result }: { result: ExportResult }) {
  const details: [string, string][] = [
    ["Format", FORMATS[result.format].label],
    ["Records", result.count.toLocaleString("en-US")],
    ["Total", formatCurrency(result.total)],
    ["File size", formatBytes(result.bytes)],
  ];
  return (
    <div className="flex flex-col items-center py-6 text-center sm:py-10" role="status">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
        <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3 className="mt-5 text-lg font-semibold text-slate-900">Export complete</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        <span className="break-all font-mono text-slate-700">{result.filename}</span> was saved to your downloads.
      </p>
      <dl className="mt-6 grid w-full max-w-lg grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-4">
        {details.map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-sm text-slate-500">
        Didn’t get the file?{" "}
        <button
          type="button"
          onClick={() => saveBlob(result.blob, result.filename)}
          className="font-semibold text-brand-600 underline-offset-2 hover:underline"
        >
          Download it again
        </button>
      </p>
    </div>
  );
}

export function ExportDialog({ open, onClose, expenses, initialOptions }: ExportDialogProps) {
  const [state, dispatch] = useReducer(exportReducer, initialOptions, initExportState);
  const { options, phase } = state;
  const { notify } = useToast();
  const exporting = phase.kind === "exporting";
  const doneRef = useRef<HTMLButtonElement>(null);

  // Move focus to the success view's primary action so keyboard users land somewhere useful.
  useEffect(() => {
    if (phase.kind === "done") doneRef.current?.focus();
  }, [phase.kind]);

  // The preview trails the controls slightly so typing and clicking stay responsive on big data sets.
  const deferred = useDeferredValue(options);
  const stale = deferred !== options;
  const rows = useMemo(() => selectRows(expenses, deferred), [expenses, deferred]);
  const summary = useMemo(() => summarize(rows), [rows]);
  const categoryCounts = useMemo(
    () => countByCategory(expenses, { from: deferred.from, to: deferred.to, keyword: deferred.keyword }),
    [expenses, deferred.from, deferred.to, deferred.keyword],
  );

  // Counts in the footer always reflect the latest options, not the deferred preview.
  const liveCount = useMemo(() => selectRows(expenses, options).length, [expenses, options]);
  const problems = validateOptions(options);
  const blocked = problems.length > 0 || liveCount === 0;
  const format = FORMATS[options.format];

  const handleExport = async () => {
    if (blocked || exporting) return;
    dispatch({ type: "start" });
    try {
      const result = await runExport(expenses, options);
      savePreferences({ format: options.format, columns: options.columns, sort: options.sort });
      dispatch({ type: "success", result });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Export failed. Please try again.";
      dispatch({ type: "fail", message });
      notify(message, { variant: "error" });
    }
  };

  // Close stays available, but not mid-export, so a half-built download can't be orphaned.
  const handleClose = () => {
    if (!exporting) onClose();
  };

  // Ctrl+Enter or Cmd+Enter exports from anywhere in the dialog.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && phase.kind !== "done") {
      e.preventDefault();
      void handleExport();
    }
  };

  useEffect(() => {
    if (!open) return;
    const warn = (e: BeforeUnloadEvent) => exporting && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, exporting]);

  const footer =
    phase.kind === "done" ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => dispatch({ type: "again" })}>
          Export another
        </Button>
        <Button ref={doneRef} onClick={onClose}>
          Done
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm" aria-live="polite">
          {phase.kind === "failed" ? (
            <p className="font-medium text-red-600">{phase.message}</p>
          ) : problems.length > 0 ? (
            <p className="font-medium text-amber-700">{problems[0]}</p>
          ) : liveCount === 0 ? (
            <p className="font-medium text-amber-700">No expenses match these filters.</p>
          ) : (
            <p className="truncate text-slate-600">
              <span className="font-semibold text-slate-900">{plural(liveCount, "expense")}</span>
              <span className="text-slate-400"> · </span>
              <span className="font-mono text-xs text-slate-500">
                {options.filename.trim()}.{format.extension}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={handleClose} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={blocked} loading={exporting} aria-keyshortcuts="Control+Enter Meta+Enter">
            {!exporting && <DownloadIcon className="h-4 w-4" />}
            {exporting ? `Generating ${format.label}…` : `Export ${liveCount > 0 ? plural(liveCount, "expense") : ""}`.trim()}
            {!exporting && (
              <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 py-0.5 font-sans text-[10px] font-medium text-white/80 lg:inline">Ctrl ↵</kbd>
            )}
          </Button>
        </div>
      </div>
    );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      title={phase.kind === "done" ? "Export ready" : "Export expenses"}
      description={phase.kind === "done" ? undefined : "Pick a format, narrow down the data, and check the preview before you download."}
      footer={footer}
    >
      <div onKeyDown={onKeyDown}>
        {phase.kind === "done" ? (
          <ExportComplete result={phase.result} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <ExportOptionsPanel
              options={options}
              filenameEdited={state.filenameEdited}
              categoryCounts={categoryCounts}
              disabled={exporting}
              dispatch={dispatch}
            />
            <ExportPreview
              rows={rows}
              summary={summary}
              options={deferred}
              stale={stale}
              onResetFilters={() => dispatch({ type: "resetFilters" })}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
