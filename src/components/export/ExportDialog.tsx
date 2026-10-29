"use client";

import { useId, useMemo, useState, type ComponentType, type SVGProps } from "react";
import type { Expense } from "@/lib/types";
import { sumAmounts } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { downloadExport, exportFilename, type ExportFormat, type ExportScope } from "@/lib/export";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CodeBracketIcon, DocumentIcon, DownloadIcon, TableIcon } from "@/components/ui/Icons";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Every expense, in the order it should be exported. */
  expenses: Expense[];
  /** The expenses currently shown while filters are active. Omit when nothing is filtered. */
  filtered?: Expense[];
}

interface FormatChoice {
  value: ExportFormat;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const FORMATS: FormatChoice[] = [
  { value: "csv", label: "CSV", description: "Opens in Excel, Numbers or Google Sheets.", icon: TableIcon },
  { value: "json", label: "JSON", description: "Structured data for scripts and backups.", icon: CodeBracketIcon },
  { value: "pdf", label: "PDF", description: "A printable report with totals.", icon: DocumentIcon },
];

function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

export function ExportDialog({ open, onClose, expenses, filtered }: ExportDialogProps) {
  const { notify } = useToast();
  const id = useId();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [scope, setScope] = useState<ExportScope>("filtered");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [exporting, setExporting] = useState(false);

  const hasFilter = filtered !== undefined;
  const effectiveScope: ExportScope = hasFilter ? scope : "all";
  const selected = effectiveScope === "filtered" && filtered ? filtered : expenses;
  const total = useMemo(() => sumAmounts(selected), [selected]);
  const filename = exportFilename(format);
  const nothingToExport = selected.length === 0;

  const handleExport = async () => {
    if (nothingToExport || exporting) return;
    setExporting(true);
    try {
      // Let the button repaint with its spinner before the synchronous build starts.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = downloadExport(selected, { format, scope: effectiveScope, includeSummary });
      notify(`Exported ${plural(selected.length, "expense")} to ${result.filename}`);
      onClose();
    } catch (err) {
      console.error(err);
      notify("Export failed. Please try again.", { variant: "error" });
    } finally {
      setExporting(false);
    }
  };

  const scopeChoices: Array<{ value: ExportScope; label: string; count: number }> = [
    { value: "filtered", label: "Currently shown", count: filtered?.length ?? 0 },
    { value: "all", label: "All expenses", count: expenses.length },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Export expenses" description="Download your expenses as a file.">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleExport();
        }}
      >
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">Format</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => {
              const checked = format === f.value;
              const Icon = f.icon;
              return (
                <label
                  key={f.value}
                  className={`flex cursor-pointer flex-col gap-1.5 rounded-xl p-3 ring-1 ring-inset transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 ${
                    checked ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-format`}
                    value={f.value}
                    checked={checked}
                    onChange={() => setFormat(f.value)}
                    className="sr-only"
                    data-autofocus={f.value === "csv" ? "" : undefined}
                  />
                  <span className={`flex items-center gap-2 text-sm font-semibold ${checked ? "text-brand-700" : "text-slate-900"}`}>
                    <Icon className="h-4 w-4" />
                    {f.label}
                  </span>
                  <span className="text-xs leading-snug text-slate-500">{f.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {hasFilter && (
          <fieldset>
            <legend className="block text-sm font-medium text-slate-700">Which expenses</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {scopeChoices.map((s) => {
                const checked = scope === s.value;
                return (
                  <label
                    key={s.value}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-inset transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 ${
                      checked ? "bg-brand-50 font-semibold text-brand-700 ring-2 ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`${id}-scope`}
                        value={s.value}
                        checked={checked}
                        onChange={() => setScope(s.value)}
                        className="sr-only"
                      />
                      {s.label}
                    </span>
                    <span className={`tabular-nums ${checked ? "text-brand-700" : "text-slate-500"}`}>{s.count.toLocaleString("en-US")}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-1">
          <span>
            <span className="block text-sm font-medium text-slate-700">Include category summary</span>
            <span className="block text-xs text-slate-500">Adds totals and share of spending for each category.</span>
          </span>
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              role="switch"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`h-6 w-11 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 ${
                includeSummary ? "bg-brand-600" : "bg-slate-300"
              }`}
            />
            <span
              aria-hidden
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${includeSummary ? "translate-x-5" : ""}`}
            />
          </span>
        </label>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500" aria-live="polite">
            {nothingToExport ? (
              hasFilter && effectiveScope === "filtered" ? (
                "No expenses match the current filters."
              ) : (
                "Nothing to export yet. Add an expense first."
              )
            ) : (
              <>
                <span className="font-semibold text-slate-900">{plural(selected.length, "expense")}</span>
                {" · "}
                <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</span>
                {" · "}
                <span className="font-mono text-xs">{filename}</span>
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={exporting} disabled={nothingToExport}>
              {!exporting && <DownloadIcon className="h-4 w-4" />}
              Export
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
