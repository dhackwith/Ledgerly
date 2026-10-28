import type { DestinationId } from "./destinations";
import type { FileFormat, TemplateId } from "./report";

export type Frequency = "daily" | "weekly" | "monthly";

export interface Schedule {
  id: string;
  name: string;
  template: TemplateId;
  destination: DestinationId;
  format: FileFormat;
  /** Email recipients, Slack channel or folder, depending on the destination. */
  target: string;
  frequency: Frequency;
  /** 0 = Sunday. Used by weekly schedules. */
  weekday: number;
  /** 1-28. Used by monthly schedules, so every month has the day. */
  monthDay: number;
  /** Local time, HH:MM. */
  time: string;
  enabled: boolean;
  createdAt: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastStatus?: "delivered" | "failed";
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function describeFrequency(s: Pick<Schedule, "frequency" | "weekday" | "monthDay" | "time">): string {
  const at = formatTime(s.time);
  if (s.frequency === "daily") return `Every day at ${at}`;
  if (s.frequency === "weekly") return `Every ${WEEKDAYS[s.weekday]} at ${at}`;
  return `Monthly on the ${ordinal(s.monthDay)} at ${at}`;
}

/** The first run strictly after `after`. */
export function nextRun(s: Pick<Schedule, "frequency" | "weekday" | "monthDay" | "time">, after: Date): Date {
  const [h, m] = s.time.split(":").map(Number);
  const c = new Date(after.getFullYear(), after.getMonth(), after.getDate(), h, m, 0, 0);
  if (s.frequency === "daily") {
    if (c <= after) c.setDate(c.getDate() + 1);
    return c;
  }
  if (s.frequency === "weekly") {
    c.setDate(c.getDate() + ((s.weekday - c.getDay() + 7) % 7));
    if (c <= after) c.setDate(c.getDate() + 7);
    return c;
  }
  c.setDate(s.monthDay);
  if (c <= after) c.setMonth(c.getMonth() + 1, s.monthDay);
  return c;
}

export function relativeTime(iso: string | undefined, now = new Date()): string {
  if (!iso) return "never";
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  // The caller's "now" can lag a few seconds behind an event that just happened, so treat both directions alike.
  if (abs < 45_000) return "just now";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000],
    ["week", 604_800_000],
    ["month", 2_592_000_000],
  ];
  let unit: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const u of units) if (abs >= u[1]) unit = u;
  return rtf.format(Math.round(diff / unit[1]), unit[0]);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
