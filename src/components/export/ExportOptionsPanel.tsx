"use client";

import type { Dispatch, ReactNode } from "react";
import { CATEGORIES, type Category } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { COLUMN_DEFS } from "@/lib/export/columns";
import { FORMATS } from "@/lib/export/formats";
import { matchPreset, RANGE_PRESETS } from "@/lib/export/presets";
import { SORT_OPTIONS } from "@/lib/export/sortOptions";
import { validateFilename } from "@/lib/export/dataset";
import { EXPORT_COLUMNS, EXPORT_FORMATS, type ExportFormat, type ExportOptions } from "@/lib/export/types";
import type { ExportAction } from "./exportReducer";

const control =
  "block w-full rounded-lg border-0 bg-white py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500";

const chip =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed";

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const FORMAT_BADGE: Record<ExportFormat, { glyph: string; className: string }> = {
  csv: { glyph: "CSV", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  json: { glyph: "{ }", className: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  pdf: { glyph: "PDF", className: "bg-rose-50 text-rose-700 ring-rose-600/20" },
};

function FormatPicker({ value, dispatch }: { value: ExportFormat; dispatch: Dispatch<ExportAction> }) {
  return (
    <div role="radiogroup" aria-label="File format" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {EXPORT_FORMATS.map((id) => {
        const f = FORMATS[id];
        return (
          <label key={id} className="relative block cursor-pointer">
            <input
              type="radio"
              name="export-format"
              value={id}
              checked={value === id}
              data-autofocus={value === id ? true : undefined}
              onChange={() => dispatch({ type: "format", format: id })}
              className="peer sr-only"
            />
            <span className="flex h-full items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 transition peer-checked:bg-brand-50/60 peer-checked:ring-2 peer-checked:ring-brand-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 hover:ring-slate-300 sm:flex-col sm:gap-2">
              <span
                className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold ring-1 ring-inset ${FORMAT_BADGE[id].className}`}
                aria-hidden
              >
                {FORMAT_BADGE[id].glyph}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{f.label}</span>
                <span className="block text-xs leading-snug text-slate-500">{f.description}</span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

interface PanelProps {
  options: ExportOptions;
  filenameEdited: boolean;
  categoryCounts: Record<Category, number>;
  disabled: boolean;
  dispatch: Dispatch<ExportAction>;
}

export function ExportOptionsPanel({ options: o, filenameEdited, categoryCounts, disabled, dispatch }: PanelProps) {
  const activePreset = matchPreset(o.from, o.to);
  const rangeInvalid = Boolean(o.from && o.to && o.from > o.to);
  const filenameError = validateFilename(o.filename);
  const allCategories = o.categories.length === CATEGORIES.length;

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <legend className="sr-only">Export options</legend>

      <Section title="Format">
        <FormatPicker value={o.format} dispatch={dispatch} />
      </Section>

      <Section title="Date range" hint="Both dates are inclusive. Leave one empty for an open range.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {RANGE_PRESETS.map((p) => {
            const active = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => dispatch({ type: "range", ...p.range(new Date()) })}
                className={`${chip} ${active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}
              >
                {p.label}
              </button>
            );
          })}
          {!activePreset && (
            <span className={`${chip} bg-slate-100 text-slate-700 ring-slate-200`} aria-live="polite">
              Custom range
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="export-from" className="mb-1 block text-xs font-medium text-slate-600">
              Start date
            </label>
            <input
              id="export-from"
              type="date"
              value={o.from}
              max={o.to || undefined}
              onChange={(e) => dispatch({ type: "range", from: e.target.value, to: o.to })}
              aria-invalid={rangeInvalid}
              className={`${control} px-3 ${rangeInvalid ? "ring-red-400" : ""}`}
            />
          </div>
          <div>
            <label htmlFor="export-to" className="mb-1 block text-xs font-medium text-slate-600">
              End date
            </label>
            <input
              id="export-to"
              type="date"
              value={o.to}
              min={o.from || undefined}
              onChange={(e) => dispatch({ type: "range", from: o.from, to: e.target.value })}
              aria-invalid={rangeInvalid}
              className={`${control} px-3 ${rangeInvalid ? "ring-red-400" : ""}`}
            />
          </div>
        </div>
        {rangeInvalid && (
          <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
            The start date is after the end date.
          </p>
        )}
      </Section>

      <Section
        title="Categories"
        hint={`${o.categories.length} of ${CATEGORIES.length} selected. Counts reflect the date range.`}
        action={
          <div className="flex gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => dispatch({ type: "setCategories", categories: [...CATEGORIES] })}
              disabled={allCategories}
              className="rounded px-1.5 py-0.5 text-brand-600 hover:bg-brand-50 disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "setCategories", categories: [] })}
              disabled={o.categories.length === 0}
              className="rounded px-1.5 py-0.5 text-brand-600 hover:bg-brand-50 disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              None
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          {CATEGORIES.map((c) => {
            const checked = o.categories.includes(c);
            const count = categoryCounts[c];
            return (
              <label
                key={c}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 ring-inset transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                  checked ? "bg-white text-slate-900 ring-slate-300" : "bg-slate-50 text-slate-400 ring-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => dispatch({ type: "toggleCategory", category: c })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-0 focus:ring-offset-0"
                  style={{ accentColor: "#2648e0" }}
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_META[c].color, opacity: checked ? 1 : 0.4 }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">{c}</span>
                <span
                  className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${count ? "bg-slate-100 text-slate-600" : "text-slate-300"}`}
                  aria-label={`${count} expenses`}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
        {o.categories.length === 0 && (
          <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
            Select at least one category.
          </p>
        )}
      </Section>

      <Section title="Keyword" hint="Optional. Keeps only expenses whose description or category contains this text.">
        <input
          id="export-keyword"
          type="search"
          aria-label="Keyword"
          placeholder="e.g. coffee, rent, uber"
          value={o.keyword}
          onChange={(e) => dispatch({ type: "keyword", keyword: e.target.value })}
          className={`${control} px-3`}
        />
      </Section>

      <Section title="Columns and order">
        <div className="flex flex-wrap items-center gap-1.5">
          {EXPORT_COLUMNS.map((col) => {
            const on = o.columns.includes(col);
            return (
              <button
                key={col}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => dispatch({ type: "toggleColumn", column: col })}
                className={`${chip} ${on ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"}`}
              >
                <svg className={`h-3 w-3 ${on ? "" : "opacity-0"}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M2.5 6.5l2.5 2.5 4.5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {COLUMN_DEFS[col].label}
              </button>
            );
          })}
        </div>
        {o.columns.length === 0 && (
          <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
            Select at least one column.
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <label htmlFor="export-sort" className="shrink-0 text-xs font-medium text-slate-600">
            Sort rows by
          </label>
          <select
            id="export-sort"
            value={o.sort}
            onChange={(e) => dispatch({ type: "sort", sort: e.target.value as ExportOptions["sort"] })}
            className={`${control} pl-3 pr-8`}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section
        title="File name"
        action={
          filenameEdited && (
            <button
              type="button"
              onClick={() => dispatch({ type: "resetFilename" })}
              className="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              Use suggested name
            </button>
          )
        }
      >
        <div
          className={`flex rounded-lg bg-white shadow-sm ring-1 ring-inset focus-within:ring-2 focus-within:ring-brand-600 ${
            filenameError ? "ring-red-400" : "ring-slate-300"
          }`}
        >
          <input
            id="export-filename"
            aria-label="File name"
            aria-invalid={Boolean(filenameError)}
            aria-describedby="export-filename-help"
            spellCheck={false}
            autoComplete="off"
            value={o.filename}
            onChange={(e) => dispatch({ type: "filename", filename: e.target.value })}
            className="min-w-0 flex-1 rounded-l-lg border-0 bg-transparent px-3 py-2 font-mono text-sm text-slate-900 focus:ring-0"
          />
          <span className="flex items-center rounded-r-lg border-l border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-500" aria-hidden>
            .{FORMATS[o.format].extension}
          </span>
        </div>
        <p id="export-filename-help" className={`mt-1.5 text-xs ${filenameError ? "font-medium text-red-600" : "text-slate-500"}`}>
          {filenameError ?? (filenameEdited ? "Custom name." : "Suggested from your filters. Type to change it.")}
        </p>
      </Section>
    </fieldset>
  );
}
