"use client";

import Link from "next/link";
import { INTEGRATIONS } from "@/lib/cloud/destinations";
import { relativeTime } from "@/lib/cloud/schedule";
import { DestinationLogo } from "./bits";
import { useCloud } from "./CloudProvider";
import { useNow } from "./ActivityTray";

/** Header pill: backup status plus the services that are connected. */
export function SyncStatus() {
  const { hydrated, jobs, snapshots, state } = useCloud();
  const now = useNow();
  if (!hydrated) return null;

  const running = jobs.some((j) => j.status === "running");
  const last = snapshots.items[0]?.at;
  const connected = INTEGRATIONS.filter((id) => state.connections[id]);

  let label: string;
  let tone: string;
  if (running) {
    label = "Syncing…";
    tone = "text-brand-700";
  } else if (!snapshots.auto) {
    label = "Backups off";
    tone = "text-amber-700";
  } else if (last) {
    label = `Backed up ${relativeTime(last, now)}`;
    tone = "text-slate-600";
  } else {
    label = "Not backed up yet";
    tone = "text-slate-500";
  }

  return (
    <Link
      href="/share"
      className="hidden items-center gap-2 rounded-full bg-white py-1 pl-2.5 pr-1.5 text-xs font-medium shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300 md:inline-flex"
      title="Open Share & sync"
    >
      {running ? (
        <svg className="h-3.5 w-3.5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className={`h-3.5 w-3.5 ${snapshots.auto && last ? "text-emerald-600" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 18.5h10.5a4 4 0 00.6-7.95A5.5 5.5 0 007.4 9.1 4.75 4.75 0 007 18.5z" />
          {snapshots.auto && last && <path d="M9.5 14l2 2 3.5-4" />}
        </svg>
      )}
      <span className={tone} aria-live="polite">
        {label}
      </span>
      {connected.length > 0 && (
        <span className="ml-0.5 flex -space-x-1.5" aria-label={`${connected.length} connected`}>
          {connected.slice(0, 3).map((id) => (
            <span key={id} className="rounded-lg ring-2 ring-white">
              <DestinationLogo id={id} size="sm" />
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}
