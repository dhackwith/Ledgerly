"use client";

import { useState } from "react";
import { DESTINATION_ORDER, DESTINATIONS, type DestinationId, type IntegrationId } from "@/lib/cloud/destinations";
import { describeFrequency, formatDateTime, relativeTime, WEEKDAYS, type Frequency, type Schedule } from "@/lib/cloud/schedule";
import { TEMPLATE_ORDER, TEMPLATES } from "@/lib/cloud/templates";
import type { FileFormat, TemplateId } from "@/lib/cloud/report";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DestinationLogo, SimulatedBadge, StatusDot } from "../bits";
import { useCloud, type NewSchedule } from "../CloudProvider";
import { useNow } from "../ActivityTray";
import { Panel, Switch } from "./shared";

const control =
  "block w-full rounded-lg border-0 bg-white py-2 px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600";

const SCHEDULABLE = DESTINATION_ORDER.filter((d) => DESTINATIONS[d].schedulable);

const RECIPES: { title: string; body: string; draft: Partial<NewSchedule> }[] = [
  {
    title: "Monthly backup to Dropbox",
    body: "A full JSON backup on the 1st of every month.",
    draft: { name: "Monthly backup", template: "full-backup", destination: "dropbox", format: "json", frequency: "monthly", monthDay: 1 },
  },
  {
    title: "Weekly pulse in Slack",
    body: "The month so far, posted every Monday morning.",
    draft: { name: "Weekly pulse", template: "monthly-summary", destination: "slack", target: "#finance", frequency: "weekly", weekday: 1 },
  },
  {
    title: "Month-end email",
    body: "Last month's summary, emailed on the 2nd.",
    draft: { name: "Month-end summary", template: "monthly-summary", destination: "email", frequency: "monthly", monthDay: 2 },
  },
];

const BLANK: NewSchedule = {
  name: "",
  template: "monthly-summary",
  destination: "email",
  format: "csv",
  target: "",
  frequency: "weekly",
  weekday: 1,
  monthDay: 1,
  time: "09:00",
  enabled: true,
};

function targetLabel(d: DestinationId) {
  if (d === "email") return "Recipients";
  if (d === "slack") return "Channel";
  if (d === "google-sheets") return "Spreadsheet";
  return "Folder";
}

function AutomationForm({ initial, editing, onSave, onClose }: { initial: NewSchedule; editing: boolean; onSave: (s: NewSchedule) => void; onClose: () => void }) {
  const { state } = useCloud();
  const [s, setS] = useState<NewSchedule>(initial);
  const set = <K extends keyof NewSchedule>(k: K, v: NewSchedule[K]) => setS((x) => ({ ...x, [k]: v }));
  const def = DESTINATIONS[s.destination];
  const notConnected = def.integration && !state.connections[s.destination as IntegrationId];

  const problems: string[] = [];
  if (!s.name.trim()) problems.push("Give the automation a name.");
  if (s.destination === "email" && !s.target.split(/[\s,;]+/).filter(Boolean).every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))) problems.push("Check the email addresses.");
  if (s.destination === "email" && !s.target.trim()) problems.push("Add at least one recipient.");
  if (s.destination === "slack" && !/^#[\w-]+$/.test(s.target)) problems.push("Slack channels start with #.");

  return (
    <Modal open onClose={onClose} title={editing ? "Edit automation" : "New automation"} description="Runs while Ledgerly is open in a browser tab. Missed runs catch up once, the next time you open it.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (problems.length === 0) onSave({ ...s, name: s.name.trim(), target: s.target.trim() });
        }}
      >
        <div>
          <label htmlFor="auto-name" className="mb-1 block text-sm font-medium text-slate-800">
            Name
          </label>
          <input id="auto-name" value={s.name} onChange={(e) => set("name", e.target.value)} className={control} placeholder="e.g. Monthly backup" maxLength={60} data-autofocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="auto-template" className="mb-1 block text-sm font-medium text-slate-800">
              Template
            </label>
            <select id="auto-template" value={s.template} onChange={(e) => set("template", e.target.value as TemplateId)} className={`${control} pr-8`}>
              {TEMPLATE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATES[t].name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="auto-dest" className="mb-1 block text-sm font-medium text-slate-800">
              Send to
            </label>
            <select
              id="auto-dest"
              value={s.destination}
              onChange={(e) => {
                const d = e.target.value as DestinationId;
                setS((x) => ({ ...x, destination: d, target: d === "slack" ? "#finance" : d === "email" ? "" : (state.connections[d as IntegrationId]?.folder ?? "") }));
              }}
              className={`${control} pr-8`}
            >
              {SCHEDULABLE.map((d) => (
                <option key={d} value={d}>
                  {DESTINATIONS[d].name}
                  {DESTINATIONS[d].integration && !state.connections[d as IntegrationId] ? " (not connected)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="auto-target" className="mb-1 block text-sm font-medium text-slate-800">
            {targetLabel(s.destination)}
          </label>
          <input
            id="auto-target"
            value={s.target}
            onChange={(e) => set("target", e.target.value)}
            className={control}
            placeholder={s.destination === "email" ? "name@example.com, another@example.com" : s.destination === "slack" ? "#finance" : "/Apps/Ledgerly"}
          />
        </div>
        {def.takesFile && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-800">Format</legend>
            <div className="flex gap-4 text-sm">
              {(["csv", "json"] as FileFormat[]).map((f) => (
                <label key={f} className="flex items-center gap-2">
                  <input type="radio" name="auto-format" checked={s.format === f} onChange={() => set("format", f)} style={{ accentColor: "#2648e0" }} />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="auto-freq" className="mb-1 block text-sm font-medium text-slate-800">
              Repeat
            </label>
            <select id="auto-freq" value={s.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)} className={`${control} pr-8`}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {s.frequency === "weekly" && (
            <div>
              <label htmlFor="auto-weekday" className="mb-1 block text-sm font-medium text-slate-800">
                On
              </label>
              <select id="auto-weekday" value={s.weekday} onChange={(e) => set("weekday", Number(e.target.value))} className={`${control} pr-8`}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          {s.frequency === "monthly" && (
            <div>
              <label htmlFor="auto-day" className="mb-1 block text-sm font-medium text-slate-800">
                Day
              </label>
              <select id="auto-day" value={s.monthDay} onChange={(e) => set("monthDay", Number(e.target.value))} className={`${control} pr-8`}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="auto-time" className="mb-1 block text-sm font-medium text-slate-800">
              Time
            </label>
            <input id="auto-time" type="time" value={s.time} onChange={(e) => set("time", e.target.value || "09:00")} className={control} />
          </div>
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
          {describeFrequency(s)} · {TEMPLATES[s.template].name} to {def.name}
        </p>
        {notConnected && <p className="text-xs font-medium text-amber-700">{def.name} isn&apos;t connected. Runs will fail until you connect it under Apps.</p>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
          {problems.length > 0 && <p className="mr-auto text-xs font-medium text-amber-700">{problems[0]}</p>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={problems.length > 0}>
            {editing ? "Save changes" : "Create automation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Automations({ formOpen, setFormOpen }: { formOpen: boolean; setFormOpen: (v: boolean) => void }) {
  const { state, addSchedule, updateSchedule, removeSchedule, runScheduleNow } = useCloud();
  const now = useNow();
  const [draft, setDraft] = useState<NewSchedule>(BLANK);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const startNew = (partial: Partial<NewSchedule> = {}) => {
    const d = { ...BLANK, ...partial };
    if (!partial.target && DESTINATIONS[d.destination].integration) d.target = state.connections[d.destination as IntegrationId]?.folder ?? "";
    setDraft(d);
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Automations"
        description="Recurring exports that run in the background."
        action={<Button onClick={() => startNew()}>New automation</Button>}
      >
        {state.schedules.length === 0 ? (
          <div className="py-4">
            <p className="text-sm text-slate-600">No automations yet. Start from a recipe:</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {RECIPES.map((r) => (
                <li key={r.title}>
                  <button
                    type="button"
                    onClick={() => startNew(r.draft)}
                    className="flex h-full w-full flex-col rounded-xl bg-slate-50 p-4 text-left ring-1 ring-slate-200 transition hover:bg-white hover:shadow-md"
                  >
                    <span className="flex items-center gap-2">
                      <DestinationLogo id={r.draft.destination!} size="sm" />
                      <span className="text-sm font-semibold text-slate-900">{r.title}</span>
                    </span>
                    <span className="mt-2 text-xs text-slate-500">{r.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {state.schedules.map((s) => {
              const def = DESTINATIONS[s.destination];
              const missing = def.integration && !state.connections[s.destination as IntegrationId];
              return (
                <li key={s.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <DestinationLogo id={s.destination} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        {s.name}
                        {def.simulated && <SimulatedBadge />}
                      </p>
                      <p className="text-xs text-slate-500">
                        {TEMPLATES[s.template].name} → {def.name}
                        {s.target ? ` (${s.target})` : ""} · {describeFrequency(s)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {s.enabled ? (
                          <span className="flex items-center gap-1.5 text-slate-700" title={formatDateTime(s.nextRunAt)}>
                            <StatusDot tone="green" /> Next run {relativeTime(s.nextRunAt, now)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <StatusDot tone="slate" /> Paused
                          </span>
                        )}
                        {s.lastRunAt && (
                          <span className={s.lastStatus === "failed" ? "text-red-600" : "text-slate-500"}>
                            Last run {relativeTime(s.lastRunAt, now)}
                            {s.lastStatus === "failed" ? " · failed" : ""}
                          </span>
                        )}
                        {missing && <span className="font-medium text-amber-700">{def.name} not connected</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Switch checked={s.enabled} onChange={(v) => updateSchedule(s.id, { enabled: v })} label={`${s.enabled ? "Pause" : "Resume"} ${s.name}`} />
                    <Button size="sm" variant="secondary" onClick={() => runScheduleNow(s.id)}>
                      Run now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(s);
                        setDraft(s);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        if (window.confirm(`Delete “${s.name}”?`)) removeSchedule(s.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {formOpen && (
        <AutomationForm
          key={editing?.id ?? "new"}
          initial={draft}
          editing={Boolean(editing)}
          onClose={() => setFormOpen(false)}
          onSave={(s) => {
            if (editing) updateSchedule(editing.id, s);
            else addSchedule(s);
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
