import { SORT_KEYS } from "./sortOptions";
import { EXPORT_COLUMNS, EXPORT_FORMATS, type ExportOptions } from "./types";

const KEY = "ledgerly:export-preferences:v1";

/** The choices worth remembering between exports. Filters and file name are per-export. */
export type ExportPreferences = Pick<ExportOptions, "format" | "columns" | "sort">;

export function loadPreferences(): Partial<ExportPreferences> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    const prefs: Partial<ExportPreferences> = {};
    if (EXPORT_FORMATS.includes(raw.format)) prefs.format = raw.format;
    if (Array.isArray(raw.columns)) {
      const columns = EXPORT_COLUMNS.filter((c) => raw.columns.includes(c));
      if (columns.length) prefs.columns = columns;
    }
    if (SORT_KEYS.includes(raw.sort)) prefs.sort = raw.sort;
    return prefs;
  } catch {
    return {};
  }
}

export function savePreferences(prefs: ExportPreferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be full or blocked; remembering preferences is only a convenience.
  }
}
