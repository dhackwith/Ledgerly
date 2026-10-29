import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/types";
import {
  CAT_GROUPS,
  LEX_NONE,
  MAX_FEATURES_PER_EXPENSE,
  RecurrenceIndex,
  amountBand,
  contextFeatures,
  domBand,
  merchantAmountFeature,
  parseDate,
  significantTokens,
  textFeatures,
} from "../features";
import { normalizeDescription, tokenize } from "../normalize";

function groupSums(features: Map<string, number>): Record<string, number> {
  const sums: Record<string, number> = {};
  features.forEach((w, key) => (sums[key[0]] = (sums[key[0]] ?? 0) + w));
  return sums;
}

describe("amount and date bands", () => {
  it.each([
    [0, 0],
    [4.99, 0],
    [5, 1],
    [14.99, 1],
    [15, 2],
    [39.99, 2],
    [40, 3],
    [99.99, 3],
    [100, 4],
    [299.99, 4],
    [300, 5],
    [5000, 5],
  ])("puts $%s in band %s", (amount, band) => {
    expect(amountBand(amount)).toBe(band);
  });

  it.each([
    [1, 0],
    [5, 0],
    [6, 1],
    [25, 1],
    [26, 2],
    [31, 2],
  ])("puts day %s in band %s", (day, band) => {
    expect(domBand(day)).toBe(band);
  });

  it("parses dates without time-zone drift", () => {
    const sat = parseDate("2026-03-14");
    const mon = parseDate("2026-03-16");
    expect(sat).toMatchObject({ dayOfMonth: 14, weekend: true });
    expect(parseDate("2026-03-15")?.weekend).toBe(true);
    expect(mon).toMatchObject({ dayOfMonth: 16, weekend: false });
    expect((mon?.dayNumber ?? 0) - (sat?.dayNumber ?? 0)).toBe(2);
    expect(parseDate("2026-3-1")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("textFeatures", () => {
  it("generates words and char 3- to 5-grams with boundary markers", () => {
    const f = textFeatures("uber");
    expect(Array.from(f.keys()).sort()).toEqual(
      ["w:uber", "c: ub", "c:ube", "c:ber", "c:er ", "c: ube", "c:uber", "c:ber ", "c: uber", "c:uber "].sort(),
    );
    expect(groupSums(f)).toEqual({ w: 1, c: expect.closeTo(1, 10) });
  });

  it("adds bigrams for multi-word text and normalizes every group to 1", () => {
    const f = textFeatures("whole foods market");
    expect(f.has("b:whole foods")).toBe(true);
    expect(f.has("b:foods market")).toBe(true);
    const sums = groupSums(f);
    for (const g of ["w", "b", "c"]) expect(sums[g]).toBeCloseTo(1, 10);
  });

  it("counts repeated n-grams", () => {
    const f = textFeatures("aaaa");
    expect(f.get("c:aaa")).toBeGreaterThan(f.get("c: aa") as number);
  });

  it("returns nothing for empty text", () => {
    expect(textFeatures("").size).toBe(0);
  });

  it("caps features per expense, keeping words first", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`);
    const f = textFeatures(normalizeDescription(words.join(" ")));
    expect(f.size).toBeLessThanOrEqual(MAX_FEATURES_PER_EXPENSE - CAT_GROUPS.length - 1);
    expect(f.has("w:wordaa")).toBe(true);
  });

  it("never splits emoji or astral characters", () => {
    const astral = String.fromCodePoint(0x20bb7); // a CJK character outside the BMP
    for (const text of [normalizeDescription("🍕 pizza night"), normalizeDescription(`${astral}${astral} 咖啡`)]) {
      for (const key of Array.from(textFeatures(text).keys())) {
        for (const ch of Array.from(key)) {
          const cp = ch.codePointAt(0) as number;
          expect(cp >= 0xd800 && cp <= 0xdfff).toBe(false);
        }
      }
    }
  });

  it("works for CJK text without spaces", () => {
    const f = textFeatures(normalizeDescription("星巴克咖啡"));
    expect(f.has("w:星巴克咖啡")).toBe(true);
    expect(f.has("c:星巴克")).toBe(true);
  });
});

describe("context features", () => {
  it("builds a merchant x amount-band feature from the first significant token", () => {
    expect(merchantAmountFeature(tokenize("the home depot"), 55)).toBe("m:home|3");
    expect(merchantAmountFeature(tokenize("amazon"), undefined)).toBeNull();
    expect(merchantAmountFeature([], 10)).toBeNull();
    expect(significantTokens(["the", "a", "home", "x", "depot"])).toEqual(["home", "depot"]);
  });

  it("emits lexicon, amount, date and recurrence groups", () => {
    const feats = contextFeatures({ tokens: tokenize("uber eats"), amount: 25, date: parseDate("2026-03-14"), recurring: false });
    expect(feats).toEqual([
      { group: 0, value: CATEGORIES.indexOf("Food"), w: 1 },
      { group: 1, value: 2, w: 1 },
      { group: 2, value: 1, w: 1 },
      { group: 3, value: 1, w: 1 },
      { group: 4, value: 0, w: 1 },
    ]);
  });

  it("splits lexicon mass across several hits and marks misses", () => {
    const feats = contextFeatures({ tokens: tokenize("gas station coffee"), date: null, recurring: null });
    expect(feats).toEqual([
      { group: 0, value: CATEGORIES.indexOf("Transportation"), w: 0.5 },
      { group: 0, value: CATEGORIES.indexOf("Food"), w: 0.5 },
    ]);
    expect(contextFeatures({ tokens: tokenize("golden dragon"), date: null, recurring: null })).toEqual([{ group: 0, value: LEX_NONE, w: 1 }]);
  });
});

describe("RecurrenceIndex", () => {
  const BILLS = CATEGORIES.indexOf("Bills");

  it("flags the same description and amount 28 to 31 days earlier", () => {
    const idx = new RecurrenceIndex();
    idx.add("sonic fiber", 100, 50, BILLS);
    expect(idx.isRecurring("sonic fiber", 127, 50)).toBe(false);
    for (const day of [128, 129, 130, 131]) expect(idx.find("sonic fiber", day, 50)).toEqual({ category: BILLS, day: 100 });
    expect(idx.isRecurring("sonic fiber", 132, 50)).toBe(false);
    expect(idx.isRecurring("other text", 130, 50)).toBe(false);
    expect(idx.isRecurring("sonic fiber", 130, undefined)).toBe(false);
  });

  it("allows a 5% amount difference and no more", () => {
    const idx = new RecurrenceIndex();
    idx.add("pge", 100, 100, BILLS);
    expect(idx.isRecurring("pge", 130, 104.9)).toBe(true);
    expect(idx.isRecurring("pge", 130, 95.1)).toBe(true);
    expect(idx.isRecurring("pge", 130, 106)).toBe(false);
  });

  it("handles out-of-order insertion and returns the most recent match", () => {
    const idx = new RecurrenceIndex();
    idx.add("rent", 160, 1800, 0);
    idx.add("rent", 100, 1800, BILLS);
    idx.add("rent", 102, 1800, 1);
    expect(idx.find("rent", 131, 1800)).toEqual({ category: 1, day: 102 });
    expect(idx.find("rent", 189, 1800)).toEqual({ category: 0, day: 160 });
  });
});
