"use client";

import { useEffect, useId, useState } from "react";
import type { Expense } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { orderedColumns } from "@/lib/export/columns";
import { FORMATS } from "@/lib/export/formats";
import type { ExportColumn, ExportOptions, ExportSummary } from "@/lib/export/types";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/Icons";

const TABLE_LIMIT = 100;

// Fixed widths keep the table inside the panel; the description column takes what's left.
const COLUMN_WIDTH: Record<ExportColumn, string> = {
  date: "w-[6.5rem] sm:w-[7.5rem]",
  category: "w-[8rem] sm:w-[9.5rem]",
  amount: "w-[5.5rem] sm:w-[6.5rem]",
  description: "",
};
const FILE_SAMPLE_ROWS = 12;

interface PreviewProps {
  rows: Expense[];
  summary: ExportSummary;
  options: ExportOptions;
  /** True while the preview is catching up with the latest option change. */
  stale: boolean;
  onResetFilters: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function spanLabel(s: ExportSummary): string {
  if (!s.firstDate || !s.lastDate) return "—";
  if (s.firstDate === s.lastDate) return formatDate(s.firstDate);
  const sameYear = s.firstDate.slice(0, 4) === s.lastDate.slice(0, 4);
  const first = sameYear ? formatDate(s.firstDate).replace(/, \d{4}$/, "") : formatDate(s.firstDate);
  return `${first} – ${formatDate(s.lastDate)}`;
}

function PreviewTable({ rows, options }: { rows: Expense[]; options: ExportOptions }) {
  const columns = orderedColumns(options.columns);
  const shown = rows.slice(0, TABLE_LIMIT);
  return (
    <div className="max-h-[22rem] overflow-auto lg:max-h-[30rem]">
      <table className="w-full min-w-[36rem] table-fixed text-left text-sm sm:min-w-0">
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} className={COLUMN_WIDTH[c.key]} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[inset_0_-1px_0_theme(colors.slate.200)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shown.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50/70">
              {columns.map((c) => {
                if (c.key === "date") return <td key={c.key} className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{formatDate(e.date)}</td>;
                if (c.key === "amount")
                  return <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-900">{formatCurrency(e.amount)}</td>;
                if (c.key === "category")
                  return (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_META[e.category].color }} aria-hidden />
                        {e.category}
                      </span>
                    </td>
                  );
                return <td key={c.key} className="truncate px-3 py-2 text-slate-700" title={e.description}>{e.description}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shows the real file output: the first lines for text formats, the full document for PDF. */
function FilePreview({ rows, summary, options }: { rows: Expense[]; summary: ExportSummary; options: ExportOptions }) {
  const [text, setText] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const isPdf = options.format === "pdf";

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setError(false);
    FORMATS[options.format]
      .load()
      .then(async (write) => {
        // Text formats only need a sample; the PDF preview is the whole report.
        const sample = isPdf ? rows : rows.slice(0, FILE_SAMPLE_ROWS);
        const blob = write({ rows: sample, summary, options, generatedAt: new Date() });
        if (cancelled) return;
        if (isPdf) {
          url = URL.createObjectURL(blob);
          setPdfUrl(url);
          setText(null);
        } else {
          setText((await blob.text()).replace(/^﻿/, ""));
          setPdfUrl(null);
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [rows, summary, options, isPdf]);

  if (error) return <p className="p-6 text-center text-sm text-red-600">The file preview couldn’t be generated.</p>;

  if (isPdf) {
    if (!pdfUrl) return <div className="h-[30rem] animate-pulse bg-slate-100" aria-label="Rendering preview" />;
    return (
      <object data={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" className="block h-[22rem] w-full lg:h-[30rem]" aria-label="PDF preview">
        <div className="p-6 text-center text-sm text-slate-500">
          This browser can’t show PDFs inline. The exported report will look the same as in any PDF viewer.
        </div>
      </object>
    );
  }

  return (
    <div className="max-h-[22rem] overflow-auto bg-slate-950 lg:max-h-[30rem]">
      <pre className="p-4 font-mono text-[12px] leading-relaxed text-slate-200">
        {text ?? "Loading…"}
        {text !== null && rows.length > FILE_SAMPLE_ROWS && (
          <span className="text-slate-500">{`\n… ${(rows.length - FILE_SAMPLE_ROWS).toLocaleString("en-US")} more ${rows.length - FILE_SAMPLE_ROWS === 1 ? "row" : "rows"}`}</span>
        )}
      </pre>
    </div>
  );
}

export function ExportPreview({ rows, summary, options, stale, onResetFilters }: PreviewProps) {
  const [tab, setTab] = useState<"table" | "file">("table");
  const tabsId = useId();
  const empty = rows.length === 0;

  return (
    <section aria-label="Export preview" className="flex min-w-0 flex-col overflow-hidden rounded-xl ring-1 ring-slate-200 lg:sticky lg:top-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          Preview
          {stale && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400" role="status">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Updating
            </span>
          )}
        </h3>
        <div role="tablist" aria-label="Preview mode" className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {(["table", "file"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`${tabsId}-${t}`}
              aria-selected={tab === t}
              aria-controls={`${tabsId}-panel`}
              disabled={empty}
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "table" ? "Table" : `${FORMATS[options.format].label} file`}
            </button>
          ))}
        </div>
      </div>

      <dl className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.8fr)] gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 transition-opacity ${stale ? "opacity-60" : ""}`}>
        <Stat label="Records" value={summary.count.toLocaleString("en-US")} />
        <Stat label="Total" value={formatCurrency(summary.total)} />
        <Stat label="Dates" value={spanLabel(summary)} />
      </dl>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className={`bg-white transition-opacity ${stale ? "opacity-60" : ""}`}>
        {empty ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <SearchIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">Nothing to export</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">No expenses match these filters. Try a wider date range or more categories.</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={onResetFilters}>
              Reset filters
            </Button>
          </div>
        ) : tab === "table" ? (
          <PreviewTable rows={rows} options={options} />
        ) : (
          <FilePreview rows={rows} summary={summary} options={options} />
        )}
      </div>

      {!empty && tab === "table" && (
        <p className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          {rows.length > TABLE_LIMIT
            ? `Showing the first ${TABLE_LIMIT} of ${rows.length.toLocaleString("en-US")} rows. The file includes all of them.`
            : `All ${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "row" : "rows"} shown.`}
        </p>
      )}
    </section>
  );
}
