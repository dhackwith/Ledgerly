import { CATEGORIES, type ExpenseInput, type RecurrenceFrequency, type RecurringRule } from "./types";
import { formatDate, parseLocalDate, toISODate } from "./format";
import { MAX_AMOUNT, MAX_DESCRIPTION } from "./validation";

export const FREQUENCIES: readonly RecurrenceFrequency[] = ["daily", "weekly", "monthly", "yearly"];

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, { singular: string; plural: string; label: string }> = {
  daily: { singular: "day", plural: "days", label: "Daily" },
  weekly: { singular: "week", plural: "weeks", label: "Weekly" },
  monthly: { singular: "month", plural: "months", label: "Monthly" },
  yearly: { singular: "year", plural: "years", label: "Yearly" },
};

/** Upper bound on occurrences generated in one pass, so a stale rule can't loop forever. */
export const MAX_OCCURRENCES = 400;
export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 365;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Adds whole months to a local date, clamping to the last day of the target month.
 * `anchorDay` is the day of month the schedule is "aiming" for, so a rule that started on
 * the 31st returns to the 31st after passing through a short month instead of drifting.
 */
function addMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const total = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, day);
}

/**
 * Returns the occurrence after `date` for the given frequency and interval.
 * Uses local-date math; month and year steps clamp to month end (Jan 31 + 1 month → Feb 28/29).
 * Pass `anchorDay` (the start date's day of month) so clamped months don't permanently shift the day.
 */
export function nextOccurrence(
  date: string,
  frequency: RecurrenceFrequency,
  interval: number,
  anchorDay?: number,
): string {
  const step = Math.max(MIN_INTERVAL, Math.floor(interval) || MIN_INTERVAL);
  const d = parseLocalDate(date);
  const anchor = anchorDay ?? d.getDate();
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + step);
      return toISODate(d);
    case "weekly":
      d.setDate(d.getDate() + 7 * step);
      return toISODate(d);
    case "monthly":
      return toISODate(addMonthsClamped(d, step, anchor));
    case "yearly":
      return toISODate(addMonthsClamped(d, 12 * step, anchor));
  }
}

function anchorDayOf(rule: Pick<RecurringRule, "startDate">): number {
  return parseLocalDate(rule.startDate).getDate();
}

function advance(rule: Pick<RecurringRule, "frequency" | "interval" | "startDate">, date: string): string {
  return nextOccurrence(date, rule.frequency, rule.interval, anchorDayOf(rule));
}

function withinEnd(rule: Pick<RecurringRule, "endDate">, date: string): boolean {
  return !rule.endDate || date <= rule.endDate;
}

export interface DueOccurrences {
  /** Dates from the rule's `nextDate` up to and including `today`, in order. */
  dates: string[];
  /** The first occurrence after `today` (or after the last generated date). */
  nextDate: string;
}

/**
 * All occurrences that are due on or before `today`, starting from `rule.nextDate`.
 * Inactive rules and dates past `endDate` yield nothing. Capped at MAX_OCCURRENCES.
 */
export function dueOccurrences(rule: RecurringRule, today: string): DueOccurrences {
  if (!rule.active) return { dates: [], nextDate: rule.nextDate };
  const dates: string[] = [];
  let cursor = rule.nextDate;
  while (cursor <= today && withinEnd(rule, cursor) && dates.length < MAX_OCCURRENCES) {
    dates.push(cursor);
    cursor = advance(rule, cursor);
  }
  return { dates, nextDate: cursor };
}

/** First occurrence of the rule's schedule that falls on or after `date`. */
export function nextOnOrAfter(
  rule: Pick<RecurringRule, "frequency" | "interval" | "startDate" | "nextDate">,
  date: string,
): string {
  let cursor = rule.nextDate < rule.startDate ? rule.startDate : rule.nextDate;
  let guard = 0;
  while (cursor < date && guard < MAX_OCCURRENCES * 10) {
    cursor = advance(rule, cursor);
    guard++;
  }
  return cursor;
}

export type GeneratedExpense = ExpenseInput & { recurringId: string };

export interface MaterializeResult {
  expenses: GeneratedExpense[];
  rules: RecurringRule[];
}

/** Expenses to create for everything due, plus the rules with their `nextDate` moved forward. */
export function materialize(rules: RecurringRule[], today: string): MaterializeResult {
  const expenses: GeneratedExpense[] = [];
  const updated = rules.map((rule) => {
    const due = dueOccurrences(rule, today);
    if (due.dates.length === 0) return rule;
    for (const date of due.dates) {
      expenses.push({
        date,
        amount: rule.amount,
        category: rule.category,
        description: rule.description,
        recurringId: rule.id,
      });
    }
    return { ...rule, nextDate: due.nextDate };
  });
  return { expenses, rules: updated };
}

export interface UpcomingOccurrence {
  date: string;
  ruleId: string;
  description: string;
  amount: number;
  category: RecurringRule["category"];
}

/** The next `limit` occurrences across all active rules, soonest first. */
export function upcoming(rules: RecurringRule[], today: string, limit: number): UpcomingOccurrence[] {
  if (limit <= 0) return [];
  const all: UpcomingOccurrence[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    let cursor = rule.nextDate < today ? nextOnOrAfter(rule, today) : rule.nextDate;
    let count = 0;
    while (withinEnd(rule, cursor) && count < limit) {
      all.push({ date: cursor, ruleId: rule.id, description: rule.description, amount: rule.amount, category: rule.category });
      cursor = advance(rule, cursor);
      count++;
    }
  }
  return all
    .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description) || a.ruleId.localeCompare(b.ruleId))
    .slice(0, limit);
}

/** Human-readable schedule, e.g. "Every month from Oct 1, 2026" or "Every 2 weeks until Dec 31, 2026". */
export function describeRule(rule: Pick<RecurringRule, "frequency" | "interval" | "startDate" | "endDate">): string {
  const unit = FREQUENCY_LABELS[rule.frequency];
  const every = rule.interval === 1 ? `Every ${unit.singular}` : `Every ${rule.interval} ${unit.plural}`;
  return rule.endDate ? `${every} until ${formatDate(rule.endDate)}` : `${every} from ${formatDate(rule.startDate)}`;
}

export interface RecurringRuleFormValues {
  description: string;
  amount: string;
  category: string;
  frequency: string;
  interval: string;
  startDate: string;
  endDate: string;
}

export type RecurringRuleFormErrors = Partial<Record<keyof RecurringRuleFormValues, string>>;

export type RecurringRuleData = Pick<
  RecurringRule,
  "description" | "amount" | "category" | "frequency" | "interval" | "startDate" | "endDate"
>;

function isValidISODate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

/** Validates form values, mirroring the expense form rules. */
export function validateRule(values: RecurringRuleFormValues): {
  errors: RecurringRuleFormErrors;
  data: RecurringRuleData | null;
} {
  const errors: RecurringRuleFormErrors = {};

  const description = values.description.trim();
  if (!description) {
    errors.description = "Please add a short description.";
  } else if (description.length > MAX_DESCRIPTION) {
    errors.description = `Keep it under ${MAX_DESCRIPTION} characters.`;
  }

  const cleanedAmount = values.amount.trim().replace(/[$,\s]/g, "");
  const amount = Number(cleanedAmount);
  if (!cleanedAmount) {
    errors.amount = "Please enter an amount.";
  } else if (!/^\d+(\.\d{0,2})?$/.test(cleanedAmount) || !Number.isFinite(amount)) {
    errors.amount = "Enter a number with up to 2 decimal places.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  } else if (amount >= MAX_AMOUNT) {
    errors.amount = "Amount must be under $1,000,000.";
  }

  if (!(CATEGORIES as readonly string[]).includes(values.category)) {
    errors.category = "Please choose a category.";
  }

  if (!(FREQUENCIES as readonly string[]).includes(values.frequency)) {
    errors.frequency = "Please choose how often this repeats.";
  }

  const intervalRaw = values.interval.trim();
  const interval = Number(intervalRaw);
  if (!intervalRaw) {
    errors.interval = "Please enter how often this repeats.";
  } else if (!/^\d+$/.test(intervalRaw) || !Number.isInteger(interval)) {
    errors.interval = "Enter a whole number.";
  } else if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
    errors.interval = `Enter a number between ${MIN_INTERVAL} and ${MAX_INTERVAL}.`;
  }

  if (!values.startDate) {
    errors.startDate = "Please choose a start date.";
  } else if (!isValidISODate(values.startDate)) {
    errors.startDate = "Enter a valid date.";
  } else if (values.startDate < "1900-01-01") {
    errors.startDate = "Date is too far in the past.";
  }

  const endDate = values.endDate.trim();
  if (endDate) {
    if (!isValidISODate(endDate)) {
      errors.endDate = "Enter a valid date.";
    } else if (values.startDate && !errors.startDate && endDate < values.startDate) {
      errors.endDate = "End date must be on or after the start date.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors, data: null };

  return {
    errors,
    data: {
      description,
      amount: Math.round(amount * 100) / 100,
      category: values.category as RecurringRuleData["category"],
      frequency: values.frequency as RecurrenceFrequency,
      interval,
      startDate: values.startDate,
      endDate: endDate || undefined,
    },
  };
}
