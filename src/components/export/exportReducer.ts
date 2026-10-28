import { CATEGORIES, type Category } from "@/lib/types";
import { stripKnownExtension, suggestFilename } from "@/lib/export/dataset";
import type { ExportColumn, ExportOptions, ExportResult } from "@/lib/export/types";

export type ExportPhase =
  | { kind: "configure" }
  | { kind: "exporting" }
  | { kind: "done"; result: ExportResult }
  | { kind: "failed"; message: string };

export interface ExportState {
  options: ExportOptions;
  /** Once the user types a file name, stop replacing it with suggestions. */
  filenameEdited: boolean;
  phase: ExportPhase;
}

export type ExportAction =
  | { type: "format"; format: ExportOptions["format"] }
  | { type: "range"; from: string; to: string }
  | { type: "toggleCategory"; category: Category }
  | { type: "setCategories"; categories: Category[] }
  | { type: "keyword"; keyword: string }
  | { type: "toggleColumn"; column: ExportColumn }
  | { type: "sort"; sort: ExportOptions["sort"] }
  | { type: "filename"; filename: string }
  | { type: "resetFilename" }
  | { type: "resetFilters" }
  | { type: "start" }
  | { type: "success"; result: ExportResult }
  | { type: "fail"; message: string }
  | { type: "again" };

/** Keeps the suggested file name in sync with the filters until the user edits it. */
function withFilename(state: ExportState, options: ExportOptions): ExportState {
  return {
    ...state,
    phase: state.phase.kind === "failed" ? { kind: "configure" } : state.phase,
    options: state.filenameEdited ? options : { ...options, filename: suggestFilename(options) },
  };
}

export function initExportState(options: ExportOptions): ExportState {
  return { options: { ...options, filename: options.filename || suggestFilename(options) }, filenameEdited: Boolean(options.filename), phase: { kind: "configure" } };
}

export function exportReducer(state: ExportState, action: ExportAction): ExportState {
  const o = state.options;
  switch (action.type) {
    case "format":
      return withFilename(state, { ...o, format: action.format });
    case "range":
      return withFilename(state, { ...o, from: action.from, to: action.to });
    case "toggleCategory": {
      const has = o.categories.includes(action.category);
      const next = has ? o.categories.filter((c) => c !== action.category) : [...o.categories, action.category];
      return withFilename(state, { ...o, categories: CATEGORIES.filter((c) => next.includes(c)) });
    }
    case "setCategories":
      return withFilename(state, { ...o, categories: CATEGORIES.filter((c) => action.categories.includes(c)) });
    case "keyword":
      return withFilename(state, { ...o, keyword: action.keyword });
    case "toggleColumn": {
      const has = o.columns.includes(action.column);
      return withFilename(state, { ...o, columns: has ? o.columns.filter((c) => c !== action.column) : [...o.columns, action.column] });
    }
    case "sort":
      return withFilename(state, { ...o, sort: action.sort });
    case "filename":
      return { ...state, filenameEdited: true, options: { ...o, filename: stripKnownExtension(action.filename) } };
    case "resetFilename":
      return { ...state, filenameEdited: false, options: { ...o, filename: suggestFilename(o) } };
    case "resetFilters":
      return withFilename(state, { ...o, from: "", to: "", categories: [...CATEGORIES], keyword: "" });
    case "start":
      return { ...state, phase: { kind: "exporting" } };
    case "success":
      return { ...state, phase: { kind: "done", result: action.result } };
    case "fail":
      return { ...state, phase: { kind: "failed", message: action.message } };
    case "again":
      return { ...state, phase: { kind: "configure" } };
  }
}
