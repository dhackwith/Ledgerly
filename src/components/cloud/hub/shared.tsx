"use client";

import type { ReactNode } from "react";
import { DESTINATIONS } from "@/lib/cloud/destinations";
import { formatDateTime, relativeTime } from "@/lib/cloud/schedule";
import type { HistoryEntry } from "@/lib/cloud/state";
import { DestinationLogo } from "../bits";

export type HubTab = "overview" | "apps" | "automations" | "links" | "history" | "backups";

export function Panel({ title, description, action, children, className = "" }: { title?: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-0 pt-5">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 ${
        checked ? "bg-brand-600" : "bg-slate-300"
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

const STATUS_STYLE: Record<HistoryEntry["status"], { label: string; className: string }> = {
  delivered: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  downloaded: { label: "Downloaded", className: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  copied: { label: "Copied", className: "bg-teal-50 text-teal-700 ring-teal-600/20" },
  "link-created": { label: "Link created", className: "bg-brand-50 text-brand-700 ring-brand-600/20" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-600/20" },
};

export function StatusPill({ status }: { status: HistoryEntry["status"] }) {
  const s = STATUS_STYLE[status];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.className}`}>{s.label}</span>;
}

export function ActivityRow({ entry, now, action }: { entry: HistoryEntry; now: Date; action?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <DestinationLogo id={entry.destination} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-slate-900">
            {entry.title} · {entry.period}
          </span>
          <StatusPill status={entry.status} />
          {entry.trigger !== "manual" && (
            <span className="text-[11px] font-medium text-slate-400">{entry.trigger === "schedule" ? "Automation" : "Live sync"}</span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{entry.detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <time dateTime={entry.at} title={formatDateTime(entry.at)} className="block text-xs text-slate-400">
          {relativeTime(entry.at, now)}
        </time>
        {action}
      </div>
    </li>
  );
}

export function destinationName(id: HistoryEntry["destination"]) {
  return DESTINATIONS[id].name;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
