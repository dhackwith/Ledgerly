"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Expense } from "@/lib/types";
import { generateId } from "@/lib/storage";
import { sumAmounts } from "@/lib/analytics";
import { DEFAULT_FOLDER, DESTINATIONS, type DestinationId, type IntegrationId } from "@/lib/cloud/destinations";
import { byteSize, reportFilename, serialize, toTsv, totalsOnly, type FileFormat, type PortableExpense, type Report, type TemplateId } from "@/lib/cloud/report";
import { nextRun, type Schedule } from "@/lib/cloud/schedule";
import { encodeShare, shareUrl } from "@/lib/cloud/share";
import { buildReport, type TemplateParams } from "@/lib/cloud/templates";
import { saveFile, splitNew } from "@/lib/cloud/importing";
import {
  EMPTY_CLOUD,
  loadCloud,
  loadSnapshots,
  saveCloud,
  saveSnapshots,
  signatureOf,
  type CloudState,
  type Connection,
  type HistoryEntry,
  type ShareLinkRecord,
  type Snapshot,
  type SnapshotReason,
  type SnapshotStore,
  type Trigger,
} from "@/lib/cloud/state";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ExportComposer } from "./ExportComposer";
import { ActivityTray } from "./ActivityTray";

export interface ExportRequest {
  template: TemplateId;
  params: TemplateParams;
  includeDetail: boolean;
  destination: DestinationId;
  format: FileFormat;
  /** Recipients, folder, spreadsheet name or channel, depending on the destination. */
  target?: string;
  message?: string;
  trigger?: Trigger;
}

export interface LinkOptions {
  password?: string;
  expiresInDays?: number;
  from?: string;
  message?: string;
}

export interface Job {
  id: string;
  title: string;
  destination: DestinationId;
  stage: string;
  progress: number;
  status: "running" | "done" | "failed";
  startedAt: string;
  detail?: string;
  trigger: Trigger;
}

export interface ComposerPreset {
  template?: TemplateId;
  destination?: DestinationId;
  params?: TemplateParams;
}

export type NewSchedule = Omit<Schedule, "id" | "createdAt" | "nextRunAt" | "lastRunAt" | "lastStatus">;

interface CloudContextValue {
  hydrated: boolean;
  state: CloudState;
  jobs: Job[];
  snapshots: SnapshotStore;
  openComposer: (preset?: ComposerPreset) => void;
  prepareReport: (req: Pick<ExportRequest, "template" | "params" | "includeDetail">) => Report;
  runExport: (req: ExportRequest) => Promise<void>;
  createLink: (req: Pick<ExportRequest, "template" | "params" | "includeDetail">, opts: LinkOptions) => Promise<ShareLinkRecord>;
  removeLink: (id: string) => void;
  connect: (id: IntegrationId) => void;
  disconnect: (id: IntegrationId) => void;
  setLiveSync: (id: IntegrationId, on: boolean) => void;
  syncNow: (id: IntegrationId) => void;
  addSchedule: (s: NewSchedule) => Schedule;
  updateSchedule: (id: string, patch: Partial<NewSchedule>) => void;
  removeSchedule: (id: string) => void;
  runScheduleNow: (id: string) => void;
  clearHistory: () => void;
  dismissJob: (id: string) => void;
  clearFinishedJobs: () => void;
  takeSnapshot: (reason?: SnapshotReason) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  setAutoSnapshots: (on: boolean) => void;
  importExpenses: (list: PortableExpense[], mode: "merge" | "replace") => { added: number; skipped: number };
}

const CloudContext = createContext<CloudContextValue | null>(null);

export function useCloud(): CloudContextValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used inside CloudProvider");
  return ctx;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** What the history and the tray say about a finished delivery. */
function deliveryDetail(req: ExportRequest, report: Report, file: { name: string; bytes: number }, connection?: Connection): string {
  switch (req.destination) {
    case "email":
      return `Sent to ${req.target || "you"} with ${file.name} attached`;
    case "google-sheets": {
      const tabs = report.tables.length;
      return `Wrote ${tabs} ${tabs === 1 ? "tab" : "tabs"} to “${req.target || "Ledgerly exports"}”`;
    }
    case "slack":
      return `Posted the summary to ${req.target || connection?.folder || "#finance"}`;
    default:
      return `Saved ${file.name} to ${req.target || connection?.folder || "/"}`;
  }
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { expenses, status, addMany, replaceAll } = useExpenses();
  const { notify } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<CloudState>(EMPTY_CLOUD);
  const [snapshots, setSnapshots] = useState<SnapshotStore>({ auto: true, items: [] });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [composer, setComposer] = useState<{ key: number; preset?: ComposerPreset } | null>(null);

  // Refs let long-running jobs and timers read the latest data without restarting.
  const expensesRef = useRef<Expense[]>(expenses);
  expensesRef.current = expenses;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(loadCloud());
    setSnapshots(loadSnapshots());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCloud(state);
  }, [state, hydrated]);

  const update = useCallback((fn: (s: CloudState) => CloudState) => setState((s) => fn(s)), []);

  const addHistory = useCallback(
    (entry: Omit<HistoryEntry, "id" | "at">) =>
      update((s) => ({ ...s, history: [{ ...entry, id: generateId(), at: new Date().toISOString() }, ...s.history] })),
    [update],
  );

  const patchJob = (id: string, patch: Partial<Job>) => setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const prepareReport = useCallback<CloudContextValue["prepareReport"]>(({ template, params, includeDetail }) => {
    const report = buildReport(template, expensesRef.current, params);
    return includeDetail ? report : totalsOnly(report);
  }, []);

  /**
   * Simulated delivery: a background job that walks through realistic stages.
   * The report and file are really generated; only the upload/send is pretend.
   */
  const startJob = useCallback(
    async (req: ExportRequest): Promise<boolean> => {
      const def = DESTINATIONS[req.destination];
      const trigger = req.trigger ?? "manual";
      const report = prepareReport(req);
      const jobId = generateId();
      const title = trigger === "live-sync" ? `Live sync to ${def.name}` : `${report.title} · ${report.period}`;
      setJobs((list) => [
        { id: jobId, title, destination: req.destination, stage: "Queued", progress: 0, status: "running", startedAt: new Date().toISOString(), trigger },
        ...list,
      ]);

      const file = serialize(report, req.format);
      const name = reportFilename(report, file.extension);
      const bytes = byteSize(file.text);
      const stages: [string, number][] = [
        ["Queued", 350],
        ["Preparing data", 450],
        [`Generating ${report.title}`, 650],
        [def.verb, 900 + Math.min(bytes / 30, 1600)],
      ];

      let done = 0;
      const totalMs = stages.reduce((a, [, ms]) => a + ms, 0);
      for (const [label, ms] of stages) {
        patchJob(jobId, { stage: label });
        // The integration could be disconnected while the job is queued.
        if (label === def.verb && def.integration && !stateRef.current.connections[req.destination as IntegrationId]) {
          const detail = `${def.name} isn't connected. Reconnect it and try again.`;
          patchJob(jobId, { status: "failed", stage: "Failed", detail });
          addHistory({ template: req.template, title: report.title, period: report.period, destination: req.destination, format: req.format, status: "failed", detail, records: report.recordCount, bytes: 0, trigger });
          notify(detail, { variant: "error" });
          return false;
        }
        const steps = Math.max(2, Math.round(ms / 120));
        for (let i = 1; i <= steps; i++) {
          await wait(ms / steps);
          patchJob(jobId, { progress: (done + (ms * i) / steps) / totalMs });
        }
        done += ms;
      }

      const connection = def.integration ? stateRef.current.connections[req.destination as IntegrationId] : undefined;
      const detail = deliveryDetail(req, report, { name, bytes }, connection);
      patchJob(jobId, { status: "done", stage: "Delivered", progress: 1, detail });
      addHistory({ template: req.template, title: report.title, period: report.period, destination: req.destination, format: def.takesFile ? req.format : undefined, status: "delivered", detail, records: report.recordCount, bytes, trigger });
      if (def.integration) {
        const now = new Date().toISOString();
        update((s) => {
          const c = s.connections[req.destination as IntegrationId];
          return c ? { ...s, connections: { ...s.connections, [req.destination]: { ...c, lastSyncAt: now } } } : s;
        });
      }
      if (trigger === "manual") notify(`${report.title} delivered to ${def.name}`);
      return true;
    },
    [addHistory, notify, prepareReport, update],
  );

  const runExport = useCallback<CloudContextValue["runExport"]>(
    async (req) => {
      const def = DESTINATIONS[req.destination];
      if (req.destination === "download") {
        const report = prepareReport(req);
        const file = serialize(report, req.format);
        const name = reportFilename(report, file.extension);
        saveFile(file.text, file.mime, name);
        addHistory({ template: req.template, title: report.title, period: report.period, destination: "download", format: req.format, status: "downloaded", detail: `Downloaded ${name}`, records: report.recordCount, bytes: byteSize(file.text), trigger: "manual" });
        notify(`Downloaded ${name}`);
        return;
      }
      if (req.destination === "clipboard") {
        const report = prepareReport(req);
        const text = toTsv(report);
        await navigator.clipboard.writeText(text);
        addHistory({ template: req.template, title: report.title, period: report.period, destination: "clipboard", status: "copied", detail: `Copied ${report.tables.length} ${report.tables.length === 1 ? "table" : "tables"} to the clipboard`, records: report.recordCount, bytes: byteSize(text), trigger: "manual" });
        notify("Copied. Paste into cell A1 of any spreadsheet.");
        return;
      }
      if (def.integration && !stateRef.current.connections[req.destination as IntegrationId]) {
        throw new Error(`Connect ${def.name} first.`);
      }
      void startJob(req);
    },
    [addHistory, notify, prepareReport, startJob],
  );

  const createLink = useCallback<CloudContextValue["createLink"]>(
    async (req, opts) => {
      const report = prepareReport(req);
      const now = new Date();
      const expiresAt = opts.expiresInDays ? new Date(now.getTime() + opts.expiresInDays * 86_400_000).toISOString() : undefined;
      const token = await encodeShare(
        { v: 1, report, sharedAt: now.toISOString(), expiresAt, from: opts.from?.trim() || undefined, message: opts.message?.trim() || undefined },
        opts.password || undefined,
      );
      const record: ShareLinkRecord = {
        id: generateId(),
        createdAt: now.toISOString(),
        title: report.title,
        period: report.period,
        url: shareUrl(token),
        expiresAt,
        protected: Boolean(opts.password),
        scope: req.includeDetail ? "full" : "totals",
        records: report.recordCount,
      };
      update((s) => ({ ...s, links: [record, ...s.links] }));
      addHistory({ template: req.template, title: report.title, period: report.period, destination: "link", status: "link-created", detail: `${record.protected ? "Password-protected link" : "Link"}${expiresAt ? `, expires ${new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ", no expiry"}`, records: report.recordCount, bytes: record.url.length, trigger: "manual" });
      return record;
    },
    [addHistory, prepareReport, update],
  );

  const removeLink = useCallback((id: string) => update((s) => ({ ...s, links: s.links.filter((l) => l.id !== id) })), [update]);

  // --- Integrations ----------------------------------------------------------

  const connect = useCallback(
    (id: IntegrationId) =>
      update((s) => ({
        ...s,
        connections: { ...s.connections, [id]: { connectedAt: new Date().toISOString(), account: "Demo account", liveSync: false, folder: DEFAULT_FOLDER[id] } },
      })),
    [update],
  );

  const disconnect = useCallback(
    (id: IntegrationId) =>
      update((s) => {
        const connections = { ...s.connections };
        delete connections[id];
        return { ...s, connections };
      }),
    [update],
  );

  const setLiveSync = useCallback(
    (id: IntegrationId, on: boolean) =>
      update((s) => {
        const c = s.connections[id];
        return c ? { ...s, connections: { ...s.connections, [id]: { ...c, liveSync: on } } } : s;
      }),
    [update],
  );

  const syncNow = useCallback(
    (id: IntegrationId) => {
      const c = stateRef.current.connections[id];
      void startJob({ template: "full-backup", params: {}, includeDetail: true, destination: id, format: "csv", target: c?.folder, trigger: "live-sync" });
    },
    [startJob],
  );

  // Live sync: after the data changes, push it to every integration that has live sync on.
  const lastSynced = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || status !== "ready") return;
    const sig = signatureOf(expenses);
    if (lastSynced.current === null) {
      lastSynced.current = sig; // first load isn't a change
      return;
    }
    if (sig === lastSynced.current) return;
    const timer = setTimeout(() => {
      lastSynced.current = sig;
      for (const [id, c] of Object.entries(stateRef.current.connections)) {
        if (c?.liveSync) syncNow(id as IntegrationId);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [expenses, hydrated, status, syncNow]);

  // --- Automations -----------------------------------------------------------

  /** Runs an automation once and records the real outcome when the job finishes. */
  const executeSchedule = useCallback(
    async (s: Schedule, reschedule: boolean) => {
      const now = new Date();
      // Plan the next run immediately so a slow job can't be started twice by the timer.
      update((st) => ({
        ...st,
        schedules: st.schedules.map((x) => (x.id === s.id ? { ...x, lastRunAt: now.toISOString(), ...(reschedule ? { nextRunAt: nextRun(x, now).toISOString() } : {}) } : x)),
      }));
      const ok = await startJob({ template: s.template, params: {}, includeDetail: true, destination: s.destination, format: s.format, target: s.target, trigger: "schedule" });
      update((st) => ({ ...st, schedules: st.schedules.map((x) => (x.id === s.id ? { ...x, lastStatus: ok ? "delivered" : "failed" } : x)) }));
    },
    [startJob, update],
  );

  // Runs due automations while the app is open. Missed runs catch up once, not once per missed slot.
  useEffect(() => {
    if (!hydrated || status !== "ready") return;
    const check = () => {
      const now = new Date();
      for (const s of stateRef.current.schedules) {
        if (s.enabled && new Date(s.nextRunAt) <= now) void executeSchedule(s, true);
      }
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [hydrated, status, executeSchedule]);

  const addSchedule = useCallback(
    (input: NewSchedule) => {
      const now = new Date();
      const s: Schedule = { ...input, id: generateId(), createdAt: now.toISOString(), nextRunAt: nextRun(input, now).toISOString() };
      update((st) => ({ ...st, schedules: [s, ...st.schedules] }));
      return s;
    },
    [update],
  );

  const updateSchedule = useCallback(
    (id: string, patch: Partial<NewSchedule>) =>
      update((st) => ({
        ...st,
        schedules: st.schedules.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          // Re-plan when timing changes or a paused automation is switched back on.
          const retime = ["frequency", "weekday", "monthDay", "time"].some((k) => k in patch) || (patch.enabled && !s.enabled);
          return retime ? { ...next, nextRunAt: nextRun(next, new Date()).toISOString() } : next;
        }),
      })),
    [update],
  );

  const removeSchedule = useCallback((id: string) => update((st) => ({ ...st, schedules: st.schedules.filter((s) => s.id !== id) })), [update]);

  const runScheduleNow = useCallback(
    (id: string) => {
      const s = stateRef.current.schedules.find((x) => x.id === id);
      if (s) void executeSchedule(s, false);
    },
    [executeSchedule],
  );

  // --- Version history -------------------------------------------------------

  const commitSnapshots = useCallback((fn: (s: SnapshotStore) => SnapshotStore) => {
    setSnapshots((s) => saveSnapshots(fn(s)));
  }, []);

  const takeSnapshot = useCallback(
    (reason: SnapshotReason = "manual") => {
      const data = expensesRef.current;
      const signature = signatureOf(data);
      commitSnapshots((s) => {
        if (reason === "auto" && s.items[0]?.signature === signature) return s;
        const snap: Snapshot = { id: generateId(), at: new Date().toISOString(), reason, count: data.length, total: sumAmounts(data), signature, data };
        return { ...s, items: [snap, ...s.items] };
      });
    },
    [commitSnapshots],
  );

  useEffect(() => {
    if (!hydrated || status !== "ready" || !snapshots.auto) return;
    if (snapshots.items[0]?.signature === signatureOf(expenses)) return;
    if (expenses.length === 0 && snapshots.items.length === 0) return;
    const timer = setTimeout(() => takeSnapshot("auto"), snapshots.items.length === 0 ? 0 : 4000);
    return () => clearTimeout(timer);
  }, [expenses, hydrated, status, snapshots.auto, snapshots.items, takeSnapshot]);

  const restoreSnapshot = useCallback(
    (id: string) => {
      const snap = snapshots.items.find((s) => s.id === id);
      if (!snap) return;
      const previous = expensesRef.current;
      takeSnapshot("before-restore");
      replaceAll(snap.data);
      notify(`Restored ${snap.count} expenses from ${new Date(snap.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`, {
        variant: "info",
        action: { label: "Undo", onClick: () => replaceAll(previous) },
      });
    },
    [notify, replaceAll, snapshots.items, takeSnapshot],
  );

  const deleteSnapshot = useCallback((id: string) => commitSnapshots((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) })), [commitSnapshots]);
  const setAutoSnapshots = useCallback((on: boolean) => commitSnapshots((s) => ({ ...s, auto: on })), [commitSnapshots]);

  const importExpenses = useCallback<CloudContextValue["importExpenses"]>(
    (list, mode) => {
      takeSnapshot("before-import");
      if (mode === "replace") {
        const now = new Date().toISOString();
        replaceAll(list.map((e) => ({ ...e, id: generateId(), createdAt: now, updatedAt: now })));
        return { added: list.length, skipped: 0 };
      }
      const { fresh, duplicates } = splitNew(list, expensesRef.current);
      if (fresh.length) addMany(fresh);
      return { added: fresh.length, skipped: duplicates };
    },
    [addMany, replaceAll, takeSnapshot],
  );

  const clearHistory = useCallback(() => update((s) => ({ ...s, history: [] })), [update]);
  const dismissJob = useCallback((id: string) => setJobs((list) => list.filter((j) => j.id !== id)), []);
  const clearFinishedJobs = useCallback(() => setJobs((list) => list.filter((j) => j.status === "running")), []);
  const openComposer = useCallback((preset?: ComposerPreset) => setComposer((c) => ({ key: (c?.key ?? 0) + 1, preset })), []);

  const value = useMemo<CloudContextValue>(
    () => ({
      hydrated,
      state,
      jobs,
      snapshots,
      openComposer,
      prepareReport,
      runExport,
      createLink,
      removeLink,
      connect,
      disconnect,
      setLiveSync,
      syncNow,
      addSchedule,
      updateSchedule,
      removeSchedule,
      runScheduleNow,
      clearHistory,
      dismissJob,
      clearFinishedJobs,
      takeSnapshot,
      restoreSnapshot,
      deleteSnapshot,
      setAutoSnapshots,
      importExpenses,
    }),
    [hydrated, state, jobs, snapshots, openComposer, prepareReport, runExport, createLink, removeLink, connect, disconnect, setLiveSync, syncNow, addSchedule, updateSchedule, removeSchedule, runScheduleNow, clearHistory, dismissJob, clearFinishedJobs, takeSnapshot, restoreSnapshot, deleteSnapshot, setAutoSnapshots, importExpenses],
  );

  return (
    <CloudContext.Provider value={value}>
      {children}
      {composer && <ExportComposer key={composer.key} preset={composer.preset} onClose={() => setComposer(null)} />}
      <ActivityTray />
    </CloudContext.Provider>
  );
}

