import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/types";
import { MerchantMemory, jaccard, trigrams } from "../memory";
import { normalizeDescription, tokenize } from "../normalize";

const FOOD = CATEGORIES.indexOf("Food");
const OTHER = CATEGORIES.indexOf("Other");
const TRANSPORT = CATEGORIES.indexOf("Transportation");
const PARAMS = { ordinalDecay: 0.5, fuzzyMin: 0.5, keyCap: 1000 };

let tick = 0;
function add(mem: MerchantMemory, raw: string, c: number, w = 1): void {
  const n = normalizeDescription(raw);
  mem.add(n, tokenize(n), raw, c, w, tick++);
}
function look(mem: MerchantMemory, raw: string) {
  const n = normalizeDescription(raw);
  return mem.lookup(n, tokenize(n));
}

describe("trigram similarity", () => {
  it("computes Jaccard over padded trigrams", () => {
    expect(trigrams("ab")).toEqual(new Set([" ab", "ab "]));
    expect(jaccard(trigrams("starbucks"), trigrams("starbucks"))).toBe(1);
    // 6 shared of 8 + 9 - 6 = 11.
    expect(jaccard(trigrams("starbuks"), trigrams("starbucks"))).toBeCloseTo(6 / 11, 12);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("MerchantMemory", () => {
  it("recalls exact descriptions with counts and the latest label", () => {
    const mem = new MerchantMemory(PARAMS);
    add(mem, "Starbucks", FOOD);
    add(mem, "STARBUCKS", FOOD);
    const [hit] = look(mem, "starbucks");
    expect(hit.kind).toBe("exact");
    expect(hit.entry.counts[FOOD]).toBe(2);
    expect(hit.entry.label).toBe("STARBUCKS");
    expect(hit.entry.streakCategory).toBe(FOOD);
    expect(hit.entry.streakWeight).toBe(2);
  });

  it("matches on the first one or two significant tokens", () => {
    const mem = new MerchantMemory(PARAMS);
    add(mem, "Starbucks", FOOD);
    add(mem, "Whole Foods Market", FOOD);
    expect(look(mem, "starbucks reserve")[0]).toMatchObject({ kind: "token", similarity: 1 });
    expect(look(mem, "the starbucks downtown")[0].kind).toBe("token");
    expect(look(mem, "whole foods downtown")[0].kind).toBe("token");
  });

  it("matches a prefix while the user is still typing", () => {
    const mem = new MerchantMemory(PARAMS);
    add(mem, "Starbucks", FOOD);
    const [hit] = look(mem, "starb");
    expect(hit.kind).toBe("prefix");
    expect(hit.similarity).toBeCloseTo(5 / 9, 12);
    expect(look(mem, "st")).toEqual([]);
  });

  it("falls back to fuzzy matching for typos", () => {
    const mem = new MerchantMemory(PARAMS);
    add(mem, "Starbucks", FOOD);
    add(mem, "Shell Oil", TRANSPORT);
    const [hit] = look(mem, "starbuks");
    expect(hit.kind).toBe("fuzzy");
    expect(hit.similarity).toBeCloseTo(6 / 11, 12);
    expect(hit.entry.counts[FOOD]).toBe(1);
    expect(look(mem, "zzzz qqqq")).toEqual([]);
  });

  it("lets a consistent new habit outweigh a longer old one", () => {
    // With decay 0.6, five old labels sum to 2.3; two new ones (1.6) beat their decayed 0.83.
    const mem = new MerchantMemory({ ...PARAMS, ordinalDecay: 0.6 });
    for (let i = 0; i < 5; i++) add(mem, "blue bottle", FOOD);
    add(mem, "blue bottle", OTHER);
    let e = look(mem, "blue bottle")[0].entry;
    expect(e.weights[FOOD]).toBeGreaterThan(e.weights[OTHER]);
    add(mem, "blue bottle", OTHER);
    e = look(mem, "blue bottle")[0].entry;
    expect(e.weights[OTHER]).toBeGreaterThan(e.weights[FOOD]);
    expect(e.counts[FOOD]).toBe(5);
    expect(e.streakCategory).toBe(OTHER);
    expect(e.streakWeight).toBe(2);
  });

  it("adds the broader merchant entry when other spellings carry more labels", () => {
    const mem = new MerchantMemory(PARAMS);
    add(mem, "uber ride", TRANSPORT);
    expect(look(mem, "uber ride").map((h) => h.kind)).toEqual(["exact"]);
    add(mem, "Uber", OTHER);
    const hits = look(mem, "uber ride");
    expect(hits.map((h) => h.kind)).toEqual(["exact", "token"]);
    expect(hits[1].entry.counts[OTHER]).toBe(1);
  });

  it("ignores zero-weight examples and empty text", () => {
    const mem = new MerchantMemory(PARAMS);
    add(mem, "starbucks", FOOD, 0);
    add(mem, "", FOOD);
    expect(mem.size).toBe(0);
    expect(look(mem, "")).toEqual([]);
  });

  it("drops the least-recently-seen keys beyond the cap", () => {
    const mem = new MerchantMemory({ ...PARAMS, keyCap: 2 });
    add(mem, "alpha cafe", FOOD);
    add(mem, "bravo cafe", FOOD);
    add(mem, "charlie cafe", FOOD);
    mem.prune();
    expect(mem.size).toBe(2);
    expect(look(mem, "alpha cafe")).toEqual([]);
    expect(look(mem, "charlie cafe")[0].kind).toBe("exact");
  });

  it("breaks fuzzy ties deterministically", () => {
    // "abcdeh" shares 4 of 8 trigrams with both keys, so they tie at 0.5; the alphabetically first wins.
    const build = (order: string[]) => {
      const mem = new MerchantMemory(PARAMS);
      for (const s of order) add(mem, s, s.endsWith("f") ? FOOD : OTHER);
      const [hit] = look(mem, "abcdeh");
      return hit && { kind: hit.kind, label: hit.entry.label };
    };
    expect(build(["abcdef", "abcdeg"])).toEqual({ kind: "fuzzy", label: "abcdef" });
    expect(build(["abcdeg", "abcdef"])).toEqual({ kind: "fuzzy", label: "abcdef" });
  });
});
