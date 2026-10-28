"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export/dataset";
import { loadPreferences } from "@/lib/export/preferences";
import type { ExportOptions } from "@/lib/export/types";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { ExportDialog } from "./ExportDialog";

/** Options a page can pre-fill, such as the filters the user is already looking at. */
export type ExportPreset = Partial<Omit<ExportOptions, "filename">>;

interface ExportContextValue {
  openExport: (preset?: ExportPreset) => void;
}

const ExportContext = createContext<ExportContextValue | null>(null);

export function useExport(): ExportContextValue {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error("useExport must be used inside ExportProvider");
  return ctx;
}

export function ExportProvider({ children }: { children: ReactNode }) {
  const { expenses } = useExpenses();
  const [session, setSession] = useState<{ id: number; options: ExportOptions } | null>(null);

  const openExport = useCallback((preset?: ExportPreset) => {
    // Remembered choices (format, columns, sort) first, then whatever the page passed in.
    const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...loadPreferences(), ...preset, filename: "" };
    setSession((s) => ({ id: (s?.id ?? 0) + 1, options }));
  }, []);

  const close = useCallback(() => setSession(null), []);

  const value = useMemo(() => ({ openExport }), [openExport]);

  return (
    <ExportContext.Provider value={value}>
      {children}
      {session && <ExportDialog key={session.id} open onClose={close} expenses={expenses} initialOptions={session.options} />}
    </ExportContext.Provider>
  );
}
