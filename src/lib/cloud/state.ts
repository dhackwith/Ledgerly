import type { Expense } from "@/lib/types";
import type { DestinationId, IntegrationId } from "./destinations";
import type { FileFormat, TemplateId } from "./report";
import type { Schedule } from "./schedule";

export interface Connection {
  connectedAt: string;
  account: string;
  /** Re-sync automatically whenever expenses change. */
  liveSync: boolean;
  lastSyncAt?: string;
  folder: string;
}

export type HistoryStatus = "delivered" | "downloaded" | "copied" | "link-created" | "failed";
export type Trigger = "manual" | "schedule" | "live-sync";

export interface HistoryEntry {
  id: string;
  at: string;
  template: TemplateId;
  title: string;
  period: string;
  destination: DestinationId;
  format?: FileFormat;
  status: HistoryStatus;
  detail: string;
  records: number;
  bytes: number;
  trigger: Trigger;
}

export interface ShareLinkRecord {
  id: string;
  createdAt: string;
  title: string;
  period: string;
  url: string;
  expiresAt?: string;
  protected: boolean;
  scope: "totals" | "full";
  records: number;
}

export interface CloudState {
  connections: Partial<Record<IntegrationId, Connection>>;
  schedules: Schedule[];
  history: HistoryEntry[];
  links: ShareLinkRecord[];
}

export const EMPTY_CLOUD: CloudState = { connections: {}, schedules: [], history: [], links: [] };

const CLOUD_KEY = "ledgerly:cloud:v1";
const MAX_HISTORY = 200;

export function loadCloud(): CloudState {
  try {
    const raw = JSON.parse(localStorage.getItem(CLOUD_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY_CLOUD;
    return {
      connections: raw.connections && typeof raw.connections === "object" ? raw.connections : {},
      schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
      history: Array.isArray(raw.history) ? raw.history.slice(0, MAX_HISTORY) : [],
      links: Array.isArray(raw.links) ? raw.links : [],
    };
  } catch {
    return EMPTY_CLOUD;
  }
}

export function saveCloud(state: CloudState): void {
  try {
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ ...state, history: state.history.slice(0, MAX_HISTORY) }));
  } catch {
    // Settings are a convenience; the app keeps working if storage is full or blocked.
  }
}

// --- Version history (snapshots) -------------------------------------------

export type SnapshotReason = "auto" | "manual" | "before-restore" | "before-import";

export interface Snapshot {
  id: string;
  at: string;
  reason: SnapshotReason;
  count: number;
  total: number;
  signature: string;
  data: Expense[];
}

export interface SnapshotStore {
  auto: boolean;
  items: Snapshot[];
}

const SNAPSHOT_KEY = "ledgerly:snapshots:v1";
export const MAX_SNAPSHOTS = 12;

/** Cheap content fingerprint (FNV-1a) so identical states aren't saved twice. */
export function signatureOf(expenses: Expense[]): string {
  const text = JSON.stringify(expenses);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${expenses.length}:${(h >>> 0).toString(36)}`;
}

export function loadSnapshots(): SnapshotStore {
  try {
    const raw = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null");
    if (!raw || !Array.isArray(raw.items)) return { auto: true, items: [] };
    return { auto: raw.auto !== false, items: raw.items };
  } catch {
    return { auto: true, items: [] };
  }
}

/** Saves snapshots, dropping the oldest ones if storage is full. Returns what was actually kept. */
export function saveSnapshots(store: SnapshotStore): SnapshotStore {
  let items = store.items.slice(0, MAX_SNAPSHOTS);
  while (true) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ auto: store.auto, items }));
      return { auto: store.auto, items };
    } catch {
      if (items.length <= 1) return { auto: store.auto, items };
      items = items.slice(0, -1);
    }
  }
}
