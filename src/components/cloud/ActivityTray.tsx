"use client";

import { useEffect, useState } from "react";
import { DESTINATIONS } from "@/lib/cloud/destinations";
import { DestinationLogo } from "./bits";
import { useCloud } from "./CloudProvider";

/** Re-renders on an interval so relative times stay fresh. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** A floating panel, like a cloud drive's upload tray, that follows background exports across pages. */
export function ActivityTray() {
  const { jobs, dismissJob, clearFinishedJobs } = useCloud();
  const [collapsed, setCollapsed] = useState(false);
  const running = jobs.filter((j) => j.status === "running").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  // Open the tray again whenever new work starts.
  useEffect(() => {
    if (running > 0) setCollapsed(false);
  }, [running]);

  if (jobs.length === 0) return null;

  const heading =
    running > 0 ? `${running} ${running === 1 ? "export" : "exports"} in progress` : failed > 0 ? `${failed} ${failed === 1 ? "export" : "exports"} failed` : "All exports finished";

  return (
    <section
      aria-label="Export activity"
      className="fixed bottom-20 left-3 right-3 z-[55] animate-slide-up overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[22rem]"
    >
      <header className="flex items-center gap-2 bg-slate-900 px-4 py-2.5 text-white">
        {running > 0 ? (
          <svg className="h-4 w-4 animate-spin text-brand-300" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg className={`h-4 w-4 ${failed ? "text-red-300" : "text-emerald-300"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.86-9.81a.75.75 0 00-1.22-.88l-3.48 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.14-.09l4-5.5z" clipRule="evenodd" />
          </svg>
        )}
        <h2 className="flex-1 text-sm font-semibold" aria-live="polite">
          {heading}
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand activity" : "Collapse activity"}
        >
          <svg className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
        {running === 0 && (
          <button type="button" onClick={clearFinishedJobs} className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close activity">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </header>

      {!collapsed && (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {jobs.map((j) => (
            <li key={j.id} className="group flex items-start gap-3 px-4 py-3">
              <DestinationLogo id={j.destination} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{j.title}</p>
                {j.status === "running" ? (
                  <>
                    <p className="mt-0.5 flex justify-between text-xs text-slate-500">
                      <span className="truncate">{j.stage}…</span>
                      <span className="tabular-nums">{Math.round(j.progress * 100)}%</span>
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(j.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={j.title}>
                      <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150" style={{ width: `${Math.max(4, j.progress * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <p className={`mt-0.5 text-xs leading-snug ${j.status === "failed" ? "text-red-600" : "text-slate-500"}`}>{j.detail}</p>
                )}
                {j.trigger !== "manual" && j.status === "running" && (
                  <p className="mt-1 text-[11px] font-medium text-slate-400">{j.trigger === "schedule" ? "Automation" : "Live sync"} · {DESTINATIONS[j.destination].name}</p>
                )}
              </div>
              {j.status !== "running" && (
                <button type="button" onClick={() => dismissJob(j.id)} className="rounded p-0.5 text-slate-300 hover:text-slate-500" aria-label={`Dismiss ${j.title}`}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
