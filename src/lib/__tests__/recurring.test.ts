import { describe, expect, it } from "vitest";
import {
  MAX_OCCURRENCES,
  describeRule,
  dueOccurrences,
  materialize,
  nextOccurrence,
  nextOnOrAfter,
  upcoming,
  validateRule,
  type RecurringRuleFormValues,
} from "@/lib/recurring";
import { parseRules } from "@/lib/recurringStorage";
import type { RecurringRule } from "@/lib/types";

function rule(partial: Partial<RecurringRule> = {}): RecurringRule {
  const startDate = partial.startDate ?? "2026-10-01";
  return {
    id: "r1",
    description: "Rent",
    amount: 1200,
    category: "Bills",
    frequency: "monthly",
    interval: 1,
    startDate,
    nextDate: startDate,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const validValues: RecurringRuleFormValues = {
  description: "Netflix",
  amount: "15.99",
  category: "Entertainment",
  frequency: "monthly",
  interval: "1",
  startDate: "2026-10-01",
  endDate: "",
};

describe("nextOccurrence", () => {
  it("steps daily and weekly, including across month and year ends", () => {
    expect(nextOccurrence("2026-10-31", "daily", 1)).toBe("2026-11-01");
    expect(nextOccurrence("2026-12-30", "daily", 3)).toBe("2027-01-02");
    expect(nextOccurrence("2026-10-28", "weekly", 1)).toBe("2026-11-04");
    expect(nextOccurrence("2026-12-25", "weekly", 2)).toBe("2027-01-08");
  });

  it("clamps monthly steps to the end of shorter months", () => {
    expect(nextOccurrence("2026-01-31", "monthly", 1)).toBe("2026-02-28");
    expect(nextOccurrence("2024-01-31", "monthly", 1)).toBe("2024-02-29");
    expect(nextOccurrence("2026-03-31", "monthly", 1)).toBe("2026-04-30");
    expect(nextOccurrence("2026-08-31", "monthly", 3)).toBe("2026-11-30");
  });

  it("returns to the anchor day after passing through a short month", () => {
    expect(nextOccurrence("2026-02-28", "monthly", 1, 31)).toBe("2026-03-31");
    expect(nextOccurrence("2026-02-28", "monthly", 1)).toBe("2026-03-28");
  });

  it("wraps monthly steps across year boundaries", () => {
    expect(nextOccurrence("2026-11-15", "monthly", 2)).toBe("2027-01-15");
    expect(nextOccurrence("2026-12-31", "monthly", 14)).toBe("2028-02-29");
  });

  it("handles leap days for yearly steps", () => {
    expect(nextOccurrence("2024-02-29", "yearly", 1)).toBe("2025-02-28");
    expect(nextOccurrence("2024-02-29", "yearly", 4)).toBe("2028-02-29");
    expect(nextOccurrence("2025-02-28", "yearly", 3, 29)).toBe("2028-02-29");
    expect(nextOccurrence("2026-06-15", "yearly", 2)).toBe("2028-06-15");
  });

  it("treats a non-positive or fractional interval as 1", () => {
    expect(nextOccurrence("2026-10-01", "daily", 0)).toBe("2026-10-02");
    expect(nextOccurrence("2026-10-01", "daily", 1.9)).toBe("2026-10-02");
  });
});

describe("dueOccurrences", () => {
  it("returns every date from nextDate through today and the first future date", () => {
    const r = rule({ frequency: "weekly", startDate: "2026-10-01" });
    expect(dueOccurrences(r, "2026-10-20")).toEqual({
      dates: ["2026-10-01", "2026-10-08", "2026-10-15"],
      nextDate: "2026-10-22",
    });
  });

  it("returns nothing when the next date is in the future", () => {
    const r = rule({ startDate: "2026-11-01" });
    expect(dueOccurrences(r, "2026-10-28")).toEqual({ dates: [], nextDate: "2026-11-01" });
  });

  it("includes today", () => {
    const r = rule({ startDate: "2026-10-28" });
    expect(dueOccurrences(r, "2026-10-28").dates).toEqual(["2026-10-28"]);
  });

  it("stops at the end date", () => {
    const r = rule({ frequency: "daily", startDate: "2026-10-01", endDate: "2026-10-03" });
    const due = dueOccurrences(r, "2026-10-31");
    expect(due.dates).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(due.nextDate).toBe("2026-10-04");
  });

  it("yields nothing for inactive rules", () => {
    const r = rule({ active: false, startDate: "2026-01-01" });
    expect(dueOccurrences(r, "2026-10-28")).toEqual({ dates: [], nextDate: "2026-01-01" });
  });

  it("keeps the monthly anchor day through short months", () => {
    const r = rule({ startDate: "2026-01-31" });
    expect(dueOccurrences(r, "2026-05-31").dates).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("caps runaway backlogs", () => {
    const r = rule({ frequency: "daily", startDate: "2020-01-01" });
    const due = dueOccurrences(r, "2026-10-28");
    expect(due.dates).toHaveLength(MAX_OCCURRENCES);
    expect(due.nextDate).toBe(nextOccurrence(due.dates[due.dates.length - 1], "daily", 1));
  });
});

describe("nextOnOrAfter", () => {
  it("advances a stale nextDate to the first occurrence on or after the date", () => {
    const r = rule({ frequency: "weekly", interval: 2, startDate: "2026-09-01", nextDate: "2026-09-01" });
    expect(nextOnOrAfter(r, "2026-10-28")).toBe("2026-11-10");
  });
  it("returns nextDate unchanged when it is already on or after the date", () => {
    const r = rule({ nextDate: "2026-11-01" });
    expect(nextOnOrAfter(r, "2026-10-28")).toBe("2026-11-01");
  });
});

describe("materialize", () => {
  it("creates tagged expenses for everything due and advances nextDate", () => {
    const rules = [
      rule({ id: "a", description: "Rent", amount: 1200, startDate: "2026-09-01" }),
      rule({ id: "b", description: "Coffee", amount: 4.5, category: "Food", frequency: "daily", startDate: "2026-10-27" }),
      rule({ id: "c", description: "Future", startDate: "2026-12-01" }),
      rule({ id: "d", description: "Paused", startDate: "2026-01-01", active: false }),
    ];
    const result = materialize(rules, "2026-10-28");
    expect(result.expenses).toEqual([
      { date: "2026-09-01", amount: 1200, category: "Bills", description: "Rent", recurringId: "a" },
      { date: "2026-10-01", amount: 1200, category: "Bills", description: "Rent", recurringId: "a" },
      { date: "2026-10-27", amount: 4.5, category: "Food", description: "Coffee", recurringId: "b" },
      { date: "2026-10-28", amount: 4.5, category: "Food", description: "Coffee", recurringId: "b" },
    ]);
    expect(result.rules.map((r) => r.nextDate)).toEqual(["2026-11-01", "2026-10-29", "2026-12-01", "2026-01-01"]);
    // Untouched rules keep their identity.
    expect(result.rules[2]).toBe(rules[2]);
    expect(result.rules[3]).toBe(rules[3]);
  });

  it("is idempotent once nextDate has been advanced", () => {
    const first = materialize([rule({ startDate: "2026-10-01" })], "2026-10-28");
    const second = materialize(first.rules, "2026-10-28");
    expect(first.expenses).toHaveLength(1);
    expect(second.expenses).toHaveLength(0);
    expect(second.rules).toEqual(first.rules);
  });
});

describe("upcoming", () => {
  it("merges active rules in date order and respects the limit", () => {
    const rules = [
      rule({ id: "a", description: "Rent", nextDate: "2026-11-01" }),
      rule({ id: "b", description: "Gym", frequency: "weekly", startDate: "2026-10-29", nextDate: "2026-10-29" }),
      rule({ id: "c", description: "Paused", nextDate: "2026-10-29", active: false }),
    ];
    const items = upcoming(rules, "2026-10-28", 4);
    expect(items.map((i) => `${i.date} ${i.description}`)).toEqual([
      "2026-10-29 Gym",
      "2026-11-01 Rent",
      "2026-11-05 Gym",
      "2026-11-12 Gym",
    ]);
  });

  it("skips past dates and stops at the end date", () => {
    const rules = [rule({ frequency: "daily", startDate: "2026-10-20", nextDate: "2026-10-20", endDate: "2026-10-29" })];
    expect(upcoming(rules, "2026-10-28", 5).map((i) => i.date)).toEqual(["2026-10-28", "2026-10-29"]);
  });

  it("returns an empty list for a non-positive limit", () => {
    expect(upcoming([rule()], "2026-10-28", 0)).toEqual([]);
  });

  it("orders same-day occurrences by description", () => {
    const rules = [rule({ id: "b", description: "Zeta", nextDate: "2026-11-01" }), rule({ id: "a", description: "Alpha", nextDate: "2026-11-01" })];
    expect(upcoming(rules, "2026-10-28", 2).map((i) => i.description)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("describeRule", () => {
  it("describes single-unit intervals with the start date", () => {
    expect(describeRule(rule({ frequency: "monthly", interval: 1, startDate: "2026-10-01" }))).toBe("Every month from Oct 1, 2026");
    expect(describeRule(rule({ frequency: "daily", interval: 1, startDate: "2026-01-05" }))).toBe("Every day from Jan 5, 2026");
  });

  it("pluralises multi-unit intervals and prefers the end date", () => {
    expect(describeRule(rule({ frequency: "weekly", interval: 2, endDate: "2026-12-31" }))).toBe("Every 2 weeks until Dec 31, 2026");
    expect(describeRule(rule({ frequency: "yearly", interval: 3, startDate: "2026-03-15" }))).toBe("Every 3 years from Mar 15, 2026");
  });
});

describe("validateRule", () => {
  it("accepts valid values and normalises them", () => {
    const result = validateRule({ ...validValues, amount: " $1,250 ", description: "  Rent  " });
    expect(result.errors).toEqual({});
    expect(result.data).toEqual({
      description: "Rent",
      amount: 1250,
      category: "Entertainment",
      frequency: "monthly",
      interval: 1,
      startDate: "2026-10-01",
      endDate: undefined,
    });
  });

  it("keeps a valid end date", () => {
    expect(validateRule({ ...validValues, endDate: "2026-12-31" }).data?.endDate).toBe("2026-12-31");
  });

  it("flags every missing field", () => {
    const { errors, data } = validateRule({
      description: "",
      amount: "",
      category: "",
      frequency: "",
      interval: "",
      startDate: "",
      endDate: "",
    });
    expect(data).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["amount", "category", "description", "frequency", "interval", "startDate"]);
  });

  it("rejects bad amounts", () => {
    expect(validateRule({ ...validValues, amount: "0" }).errors.amount).toMatch(/greater than zero/);
    expect(validateRule({ ...validValues, amount: "12.345" }).errors.amount).toMatch(/2 decimal/);
    expect(validateRule({ ...validValues, amount: "abc" }).errors.amount).toMatch(/2 decimal/);
    expect(validateRule({ ...validValues, amount: "1000000" }).errors.amount).toMatch(/under/);
  });

  it("rejects long descriptions", () => {
    expect(validateRule({ ...validValues, description: "x".repeat(121) }).errors.description).toMatch(/120/);
    expect(validateRule({ ...validValues, description: "x".repeat(120) }).errors.description).toBeUndefined();
  });

  it("rejects intervals outside 1..365 or non-integers", () => {
    expect(validateRule({ ...validValues, interval: "0" }).errors.interval).toMatch(/between 1 and 365/);
    expect(validateRule({ ...validValues, interval: "366" }).errors.interval).toMatch(/between 1 and 365/);
    expect(validateRule({ ...validValues, interval: "1.5" }).errors.interval).toMatch(/whole number/);
    expect(validateRule({ ...validValues, interval: "365" }).errors.interval).toBeUndefined();
  });

  it("rejects unknown frequencies and categories", () => {
    expect(validateRule({ ...validValues, frequency: "hourly" }).errors.frequency).toBeDefined();
    expect(validateRule({ ...validValues, category: "Pets" }).errors.category).toBeDefined();
  });

  it("requires the end date to be on or after the start date", () => {
    expect(validateRule({ ...validValues, startDate: "2026-10-10", endDate: "2026-10-09" }).errors.endDate).toMatch(/on or after/);
    expect(validateRule({ ...validValues, startDate: "2026-10-10", endDate: "2026-10-10" }).errors.endDate).toBeUndefined();
    expect(validateRule({ ...validValues, endDate: "nope" }).errors.endDate).toMatch(/valid date/);
  });

  it("rejects invalid or ancient start dates", () => {
    expect(validateRule({ ...validValues, startDate: "2026-13-01" }).errors.startDate).toMatch(/valid date/);
    expect(validateRule({ ...validValues, startDate: "1899-12-31" }).errors.startDate).toMatch(/too far/);
  });
});

describe("parseRules", () => {
  it("throws when the stored value is not a list", () => {
    expect(() => parseRules({})).toThrow();
    expect(() => parseRules("nope")).toThrow();
  });

  it("keeps valid records and fills in missing timestamps", () => {
    const { createdAt: _c, updatedAt: _u, ...bare } = rule();
    const [parsed] = parseRules([bare]);
    expect(parsed).toMatchObject(bare);
    expect(typeof parsed.createdAt).toBe("string");
    expect(typeof parsed.updatedAt).toBe("string");
  });

  it("drops malformed records", () => {
    const good = rule({ id: "good" });
    const bad = [
      null,
      "string",
      { ...good, id: 1 },
      { ...good, amount: "12" },
      { ...good, category: "Pets" },
      { ...good, frequency: "hourly" },
      { ...good, interval: 0 },
      { ...good, interval: 1.5 },
      { ...good, startDate: "10/01/2026" },
      { ...good, endDate: 42 },
      { ...good, nextDate: undefined },
      { ...good, active: "yes" },
    ];
    const parsed = parseRules([...bad, good]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("good");
  });
});
