"use client";

import { useMemo, type ReactNode } from "react";
import { formatMonthKey, monthKey, toISODate } from "@/lib/format";
import { INTEGRATIONS } from "@/lib/cloud/destinations";
import { relativeTime } from "@/lib/cloud/schedule";
import { buildReport, TEMPLATE_ORDER, TEMPLATES } from "@/lib/cloud/templates";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { SparklesIcon } from "@/components/ui/Icons";
import { DestinationLogo } from "../bits";
import { useCloud, type ComposerPreset } from "../CloudProvider";
import { useNow } from "../ActivityTray";
import { ActivityRow, Panel, type HubTab } from "./shared";

interface Suggestion {
  id: string;
  title: string;
  body: string;
  cta: string;
  run: () => void;
}

function QuickAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      {children}
      <span className="text-sm font-semibold text-white">{label}</span>
    </button>
  );
}

export function Overview({ goTo, newAutomation }: { goTo: (tab: HubTab) => void; newAutomation: () => void }) {
  const cloud = useCloud();
  const { expenses } = useExpenses();
  const now = useNow();
  const { state, snapshots, openComposer } = cloud;

  const open = (preset: ComposerPreset) => openComposer(preset);

  // Contextual nudges, the way a SaaS dashboard suggests the next useful thing.
  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const today = new Date();
    const lastMonth = monthKey(toISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
    if (today.getDate() <= 10 && expenses.some((e) => monthKey(e.date) === lastMonth)) {
      const name = formatMonthKey(lastMonth, "long").split(" ")[0];
      out.push({
        id: "month-wrap",
        title: `${name} is wrapped up`,
        body: `Share your ${name} summary with a partner or roommate. Totals only, if you prefer.`,
        cta: "Share summary",
        run: () => open({ template: "monthly-summary", params: { month: lastMonth }, destination: "link" }),
      });
    }
    const lastYear = today.getFullYear() - 1;
    if (today.getMonth() <= 3 && expenses.some((e) => e.date.startsWith(`${lastYear}-`))) {
      out.push({
        id: "tax",
        title: "It's tax season",
        body: `Hand your accountant a ${lastYear} Tax Report with quarterly totals and an itemized ledger.`,
        cta: "Prepare report",
        run: () => open({ template: "tax-report", params: { year: lastYear } }),
      });
    }
    if (expenses.length >= 10) {
      const analysis = buildReport("category-analysis", expenses, { months: 6 }, today);
      const growing = analysis.metrics.find((m) => m.label === "Fastest growing");
      if (growing && growing.value !== "—") {
        out.push({
          id: "trend",
          title: `${growing.value} spending is climbing`,
          body: `${growing.hint}. A Category Analysis shows where it's coming from.`,
          cta: "Analyze",
          run: () => open({ template: "category-analysis", params: { months: 6 } }),
        });
      }
    }
    if (state.schedules.length === 0) {
      out.push({
        id: "automate",
        title: "Put backups on autopilot",
        body: "Send a full backup to your cloud drive every month without thinking about it.",
        cta: "Create automation",
        run: newAutomation,
      });
    }
    const sheets = state.connections["google-sheets"];
    if (sheets && !sheets.liveSync) {
      out.push({
        id: "live",
        title: "Make Google Sheets live",
        body: "Turn on live sync and your spreadsheet updates whenever you change an expense.",
        cta: "Turn on",
        run: () => cloud.setLiveSync("google-sheets", true),
      });
    }
    if (!snapshots.auto) {
      out.push({ id: "snap", title: "Automatic backups are off", body: "Version history lets you roll back mistakes in one click.", cta: "Turn on", run: () => cloud.setAutoSnapshots(true) });
    }
    return out.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, state.schedules.length, state.connections, snapshots.auto]);

  const connected = INTEGRATIONS.filter((id) => state.connections[id]);
  const active = state.schedules.filter((s) => s.enabled);
  const nextAutomation = active.map((s) => s.nextRunAt).sort()[0];
  const liveLinks = state.links.filter((l) => !l.expiresAt || new Date(l.expiresAt) > now);
  const lastSnapshot = snapshots.items[0];

  const tiles: { label: string; value: string; hint: string; tab: HubTab }[] = [
    {
      label: "Backups",
      value: snapshots.auto ? (lastSnapshot ? relativeTime(lastSnapshot.at, now) : "Waiting") : "Off",
      hint: `${snapshots.items.length} ${snapshots.items.length === 1 ? "version" : "versions"} saved`,
      tab: "backups",
    },
    { label: "Connected apps", value: `${connected.length} of ${INTEGRATIONS.length}`, hint: connected.length ? "Simulated connections" : "None yet", tab: "apps" },
    { label: "Automations", value: `${active.length} active`, hint: nextAutomation ? `Next ${relativeTime(nextAutomation, now)}` : "Nothing scheduled", tab: "automations" },
    { label: "Share links", value: `${liveLinks.length} live`, hint: `${state.links.length - liveLinks.length} expired`, tab: "links" },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-56 w-56 rounded-full bg-emerald-300/20 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="text-sm font-medium text-brand-100">Share & sync</p>
          <h2 className="mt-1 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Your numbers, wherever they need to be.</h2>
          <p className="mt-2 max-w-xl text-sm text-brand-100">Send reports to people and apps, keep spreadsheets in sync, and let automations do the routine work.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction label="Share a link" onClick={() => open({ destination: "link" })}>
              <DestinationLogo id="link" />
            </QuickAction>
            <QuickAction label="Email a report" onClick={() => open({ destination: "email" })}>
              <DestinationLogo id="email" />
            </QuickAction>
            <QuickAction label="Send to Sheets" onClick={() => open({ destination: "google-sheets" })}>
              <DestinationLogo id="google-sheets" />
            </QuickAction>
            <QuickAction label="Automate it" onClick={newAutomation}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white" aria-hidden>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" />
                </svg>
              </span>
            </QuickAction>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => goTo(t.tab)}
            className="rounded-2xl bg-white p-4 text-left shadow-card ring-1 ring-slate-200/70 transition hover:ring-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <span className="block text-xs font-medium text-slate-500">{t.label}</span>
            <span className="mt-1 block text-lg font-semibold text-slate-900">{t.value.charAt(0).toUpperCase() + t.value.slice(1)}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">{t.hint}</span>
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <Panel
          title="Suggested for you"
          description="Based on the date and what's in your data."
          action={<SparklesIcon className="h-5 w-5 text-amber-500" />}
        >
          <ul className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => (
              <li key={s.id} className="flex flex-col rounded-xl bg-gradient-to-br from-amber-50/70 to-white p-4 ring-1 ring-amber-200/60">
                <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{s.body}</p>
                <button type="button" onClick={s.run} className="mt-3 self-start text-sm font-semibold text-brand-600 hover:text-brand-700">
                  {s.cta} →
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Templates" description="Each template shapes the same data for a different audience.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_ORDER.map((id) => {
            const t = TEMPLATES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => open({ template: id })}
                className="group relative overflow-hidden rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200 transition hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: t.accent }} aria-hidden />
                <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
                <span className="mt-1 block text-xs leading-snug text-slate-500">{t.tagline}</span>
                <span className="mt-3 block text-xs font-semibold text-brand-600 opacity-80 group-hover:opacity-100">Use template →</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Recent activity"
        action={
          state.history.length > 0 && (
            <button type="button" onClick={() => goTo("history")} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all
            </button>
          )
        }
      >
        {state.history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nothing exported yet. Pick a template or a quick action to get started.</p>
        ) : (
          <ul className="-my-3 divide-y divide-slate-100">
            {state.history.slice(0, 5).map((h) => (
              <ActivityRow key={h.id} entry={h} now={now} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
