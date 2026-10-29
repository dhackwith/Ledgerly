import { describe, expect, it } from "vitest";
import { CATEGORIES, type Category } from "@/lib/types";
import { LEXICON, LEXICON_VERSION, MAX_LEXICON_TOKENS, lexiconIndex, matchLexicon } from "../lexicon";
import { normalizeDescription, tokenize } from "../normalize";

const entries = (Object.entries(LEXICON) as [Category, readonly string[]][]).flatMap(([category, keys]) => keys.map((key) => ({ category, key })));

describe("lexicon integrity", () => {
  it("covers exactly the valid categories", () => {
    expect(Object.keys(LEXICON).sort()).toEqual([...CATEGORIES].sort());
    for (const { category } of entries) expect(CATEGORIES).toContain(category);
  });

  it("stays a modest size", () => {
    expect(entries.length).toBeGreaterThanOrEqual(300);
    expect(entries.length).toBeLessThanOrEqual(600);
    expect(LEXICON_VERSION).toMatch(/^\d+$/);
  });

  it("stores keys already normalized, with at most MAX_LEXICON_TOKENS tokens", () => {
    for (const { key } of entries) {
      expect(key.length).toBeGreaterThan(0);
      expect(normalizeDescription(key)).toBe(key);
      expect(tokenize(key).length).toBeLessThanOrEqual(MAX_LEXICON_TOKENS);
    }
  });

  it("has no duplicate or conflicting keys", () => {
    const seen = new Map<string, Category>();
    const problems: string[] = [];
    for (const { key, category } of entries) {
      const prev = seen.get(key);
      if (prev) problems.push(prev === category ? `duplicate "${key}" in ${category}` : `"${key}" in both ${prev} and ${category}`);
      seen.set(key, category);
    }
    expect(problems).toEqual([]);
    expect(lexiconIndex().size).toBe(entries.length);
  });
});

describe("matchLexicon", () => {
  const match = (text: string) => matchLexicon(tokenize(normalizeDescription(text)));

  it("prefers the longest match", () => {
    expect(match("Uber Eats")).toEqual([{ key: "uber eats", category: "Food" }]);
    expect(match("uber")).toEqual([{ key: "uber", category: "Transportation" }]);
    expect(match("gas bill")).toEqual([{ key: "gas bill", category: "Bills" }]);
    expect(match("parking ticket")).toEqual([{ key: "parking ticket", category: "Other" }]);
    expect(match("Chick-fil-A sandwich")).toEqual([
      { key: "chick fil a", category: "Food" },
      { key: "sandwich", category: "Food" },
    ]);
  });

  it("finds several hits and ignores unknown words", () => {
    expect(match("gas station coffee")).toEqual([
      { key: "gas station", category: "Transportation" },
      { key: "coffee", category: "Food" },
    ]);
    expect(match("golden dragon")).toEqual([]);
    expect(match("")).toEqual([]);
  });

  it("matches emoji entries", () => {
    expect(match("⛽ fill up")).toEqual([{ key: "⛽", category: "Transportation" }]);
  });
});
