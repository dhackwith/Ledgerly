"use client";

import { useState } from "react";
import { DESTINATIONS } from "@/lib/cloud/destinations";
import { formatDateTime, relativeTime } from "@/lib/cloud/schedule";
import type { HistoryEntry } from "@/lib/cloud/state";
import { Button } from "@/components/ui/Button";
import { DestinationLogo } from "../bits";
import { useCloud } from "../CloudProvider";
import { useNow } from "../ActivityTray";
import { ActivityRow, formatBytes, Panel, StatusPill } from "./shared";

const FILTERS: { id: string; label: string; test: (h: HistoryEntry) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "manual", label: "Manual", test: (h) => h.trigger === "manual" },
  { id: "auto", label: "Automated", test: (h) => h.trigger !== "manual" },
  { id: "failed", label: "Failed", test: (h) => h.status === "failed" },
];

export function History() {
  const { state, clearHistory, openComposer } = useCloud();
  const now = useNow();
  const [filter, setFilter] = useState("all");
  const rows = state.history.filter(FILTERS.find((f) => f.id === filter)!.test);

  return (
    <Panel
      title="Export history"
      description="Every export, share and sync from this device, newest first."
      action={
        state.history.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm("Clear the export history? Files and links you already sent aren't affected.")) clearHistory();
            }}
          >
            Clear history
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter history">
        {FILTERS.map((f) => {
          const count = state.history.filter(f.test).length;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${filter === f.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}
            >
              {f.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{state.history.length ? "Nothing matches this filter." : "Exports you run will be listed here."}</p>
      ) : (
        <>
        {/* Phones get a compact list; the full table needs room. */}
        <ul className="-my-3 divide-y divide-slate-100 sm:hidden">
          {rows.map((h) => (
            <ActivityRow
              key={h.id}
              entry={h}
              now={now}
              action={
                <button type="button" onClick={() => openComposer({ template: h.template, destination: h.destination })} className="mt-1 text-xs font-semibold text-brand-600">
                  {h.status === "failed" ? "Retry" : "Run again"}
                </button>
              }
            />
          ))}
        </ul>
        <div className="-mx-5 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2 font-semibold">When</th>
                <th scope="col" className="px-3 py-2 font-semibold">Export</th>
                <th scope="col" className="px-3 py-2 font-semibold">Destination</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Records</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Size</th>
                <th scope="col" className="px-5 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((h) => (
                <tr key={h.id} className="align-top hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                    <time dateTime={h.at} title={formatDateTime(h.at)}>{relativeTime(h.at, now)}</time>
                    <span className="block text-[11px] text-slate-400">{h.trigger === "manual" ? "Manual" : h.trigger === "schedule" ? "Automation" : "Live sync"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-slate-900">{h.title}</span>
                    <span className="block text-xs text-slate-500">{h.period}</span>
                    <span className="mt-0.5 block max-w-xs truncate text-xs text-slate-400" title={h.detail}>{h.detail}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="flex items-center gap-2 text-slate-700">
                      <DestinationLogo id={h.destination} size="sm" />
                      {DESTINATIONS[h.destination].name}
                      {h.format && <span className="text-[11px] uppercase text-slate-400">{h.format}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3"><StatusPill status={h.status} /></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{h.records.toLocaleString("en-US")}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-500">{formatBytes(h.bytes)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button type="button" onClick={() => openComposer({ template: h.template, destination: h.destination })} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                      {h.status === "failed" ? "Retry" : "Run again"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Panel>
  );
}
