"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { INTEGRATIONS } from "@/lib/cloud/destinations";
import { useCloud } from "@/components/cloud/CloudProvider";
import { Overview } from "@/components/cloud/hub/Overview";
import { Apps } from "@/components/cloud/hub/Apps";
import { Automations } from "@/components/cloud/hub/Automations";
import { Links } from "@/components/cloud/hub/Links";
import { History } from "@/components/cloud/hub/History";
import { Backups } from "@/components/cloud/hub/Backups";
import type { HubTab } from "@/components/cloud/hub/shared";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlusIcon } from "@/components/ui/Icons";
import { useExpenses } from "@/components/providers/ExpenseProvider";

const TABS: { id: HubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "apps", label: "Apps" },
  { id: "automations", label: "Automations" },
  { id: "links", label: "Links" },
  { id: "history", label: "History" },
  { id: "backups", label: "Backups" },
];

const BANNER_KEY = "ledgerly:demo-banner-dismissed";

export default function SharePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ShareHub />
    </Suspense>
  );
}

function ShareHub() {
  const cloud = useCloud();
  const { status } = useExpenses();
  const router = useRouter();
  const param = useSearchParams().get("tab");
  // The tab lives in the URL (?tab=links) so it survives reloads and can be linked to.
  const tab: HubTab = TABS.some((x) => x.id === param) ? (param as HubTab) : "overview";
  const [automationForm, setAutomationForm] = useState(false);
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    try {
      setBanner(localStorage.getItem(BANNER_KEY) !== "1");
    } catch {
      setBanner(true);
    }
  }, []);

  const goTo = (t: HubTab) => {
    router.replace(t === "overview" ? "/share" : `/share?tab=${t}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const counts: Partial<Record<HubTab, number>> = {
    apps: INTEGRATIONS.filter((id) => cloud.state.connections[id]).length,
    automations: cloud.state.schedules.filter((s) => s.enabled).length,
    links: cloud.state.links.length,
    history: cloud.state.history.filter((h) => h.status === "failed").length || undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Share & sync</h1>
          <p className="mt-1 text-sm text-slate-500">Reports, links, connected apps and backups in one place.</p>
        </div>
        <Button onClick={() => cloud.openComposer()} disabled={status !== "ready"}>
          <PlusIcon className="h-4 w-4" />
          New export
        </Button>
      </div>

      {banner && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200" role="note">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.25v3.25a.75.75 0 001.5 0V9.75A.75.75 0 0010 9H9z" clipRule="evenodd" />
          </svg>
          <p className="flex-1 leading-relaxed">
            <span className="font-semibold">Demo build.</span> Email, Google Sheets, Drive, Dropbox, OneDrive and Slack are simulated: you&apos;ll see the full flow, but
            nothing is sent to those services. Downloads, copy-to-spreadsheet, share links, QR codes, version history and backup files are fully working.
          </p>
          <button
            type="button"
            onClick={() => {
              setBanner(false);
              try {
                localStorage.setItem(BANNER_KEY, "1");
              } catch {
                /* ignore */
              }
            }}
            className="rounded-md px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            Got it
          </button>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Share & sync sections" className="inline-flex min-w-full gap-1 border-b border-slate-200 sm:min-w-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="hub-panel"
              onClick={() => goTo(t.id)}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {counts[t.id] ? (
                <span className={`rounded-full px-1.5 text-[11px] font-semibold ${t.id === "history" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{counts[t.id]}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div id="hub-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {!cloud.hydrated || status === "loading" ? (
          <div className="space-y-4">
            <Skeleton className="h-56" />
            <Skeleton className="h-32" />
          </div>
        ) : tab === "overview" ? (
          <Overview
            goTo={goTo}
            newAutomation={() => {
              goTo("automations");
              setAutomationForm(true);
            }}
          />
        ) : tab === "apps" ? (
          <Apps />
        ) : tab === "automations" ? (
          <Automations formOpen={automationForm} setFormOpen={setAutomationForm} />
        ) : tab === "links" ? (
          <Links />
        ) : tab === "history" ? (
          <History />
        ) : (
          <Backups />
        )}
      </div>
    </div>
  );
}
