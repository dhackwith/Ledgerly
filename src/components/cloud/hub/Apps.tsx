"use client";

import { useState } from "react";
import { DESTINATIONS, INTEGRATIONS, type IntegrationId } from "@/lib/cloud/destinations";
import { relativeTime } from "@/lib/cloud/schedule";
import { Button } from "@/components/ui/Button";
import { DestinationLogo, SimulatedBadge, StatusDot } from "../bits";
import { ConnectDialog } from "../ConnectDialog";
import { useCloud } from "../CloudProvider";
import { useNow } from "../ActivityTray";
import { Switch } from "./shared";

const COMING_SOON = [
  { name: "Notion", note: "Append monthly summaries to a database" },
  { name: "Airtable", note: "Mirror expenses into a base" },
  { name: "Webhooks", note: "POST every export to your own endpoint" },
];

export function Apps() {
  const { state, jobs, disconnect, setLiveSync, syncNow, openComposer } = useCloud();
  const now = useNow(15_000);
  const [connecting, setConnecting] = useState<IntegrationId | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((id) => {
          const def = DESTINATIONS[id];
          const c = state.connections[id];
          const syncing = jobs.some((j) => j.destination === id && j.status === "running");
          const failed = jobs.find((j) => j.destination === id && j.status === "failed");
          const tone = syncing ? "blue" : failed ? "red" : c?.lastSyncAt ? "green" : "slate";
          return (
            <article key={id} className="flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
              <div className="flex items-start gap-3">
                <DestinationLogo id={id} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                    {def.name} <SimulatedBadge />
                  </h3>
                  <p className="text-sm text-slate-500">{def.description}</p>
                </div>
              </div>

              {c ? (
                <>
                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
                    <div>
                      <dt className="text-slate-500">Account</dt>
                      <dd className="font-medium text-slate-800">{c.account}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{id === "slack" ? "Default channel" : "Folder"}</dt>
                      <dd className="truncate font-mono text-slate-800">{c.folder}</dd>
                    </div>
                    <div className="col-span-2 flex items-center gap-2" aria-live="polite">
                      <StatusDot tone={tone} pulse={syncing} />
                      <span className="text-slate-700">
                        {syncing ? "Syncing now…" : failed ? "Last export failed" : c.lastSyncAt ? `Last delivery ${relativeTime(c.lastSyncAt, now)}` : `Connected ${relativeTime(c.connectedAt, now)}, nothing sent yet`}
                      </span>
                    </div>
                  </dl>
                  {id !== "slack" && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Live sync</p>
                        <p className="text-xs text-slate-500">Push every change in the background</p>
                      </div>
                      <Switch checked={c.liveSync} onChange={(v) => setLiveSync(id, v)} label={`Live sync to ${def.name}`} />
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button size="sm" variant="secondary" onClick={() => openComposer({ destination: id })}>
                      Send a report
                    </Button>
                    {id !== "slack" && (
                      <Button size="sm" variant="secondary" onClick={() => syncNow(id)} disabled={syncing}>
                        Sync now
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        if (window.confirm(`Disconnect ${def.name}? Automations that use it will fail until you reconnect.`)) disconnect(id);
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <StatusDot tone="slate" /> Not connected
                  </span>
                  <Button size="sm" onClick={() => setConnecting(id)}>
                    Connect
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">On the roadmap</h3>
        <ul className="grid gap-3 sm:grid-cols-3">
          {COMING_SOON.map((c) => (
            <li key={c.name} className="rounded-2xl border border-dashed border-slate-300 p-4">
              <p className="text-sm font-semibold text-slate-700">{c.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{c.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {connecting && <ConnectDialog id={connecting} onClose={() => setConnecting(null)} />}
    </div>
  );
}
