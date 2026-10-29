import { describe, expect, it } from "vitest";
import { MAX_INPUT_CHARS, isUninformative, normalizeDescription, tokenize } from "../normalize";

describe("normalizeDescription", () => {
  it.each([
    ["Starbucks", "starbucks"],
    ["  Whole   Foods\tMarket  ", "whole foods market"],
    ["SQ *BLUE BOTTLE 0423", "blue bottle"],
    ["TST* Joe's Diner", "joes diner"],
    ["PP*NETFLIX", "netflix"],
    ["PAYPAL *SPOTIFY", "spotify"],
    ["DD *DOORDASH", "doordash"],
    // The part before "*" is the merchant here, so it must survive.
    ["UBER *EATS", "uber eats"],
    ["LYFT *RIDE", "lyft ride"],
  ])("strips card prefixes and noise: %s", (raw, expected) => {
    expect(normalizeDescription(raw)).toBe(expected);
  });

  it.each([
    ["Starbucks #0423", "starbucks"],
    ["STARBUCKS STORE 12345 SEATTLE WA", "starbucks store seattle wa"],
    ["SHELL OIL 57442", "shell oil"],
    ["AMZN Mktp US*2K3AB45", "amzn mktp us"],
    ["POS DEBIT WALMART", "walmart"],
    ["amazon.com", "amazon"],
    ["Five Guys 12", "five guys 12"],
    ["7-Eleven", "7 eleven"],
  ])("removes store numbers, reference IDs and bank filler: %s", (raw, expected) => {
    expect(normalizeDescription(raw)).toBe(expected);
  });

  it.each([
    ["!!!Uber!!!", "uber"],
    ["McDonald’s", "mcdonalds"],
    ["Barnes & Noble", "barnes noble"],
    ["AT&T", "at&t"],
    ["H&M", "h&m"],
    ["Café Crème", "cafe creme"],
    ["ＳＴＡＲＢＵＣＫＳ", "starbucks"],
    ["ﬁve guys", "five guys"],
  ])("handles punctuation, accents and compatibility forms: %s", (raw, expected) => {
    expect(normalizeDescription(raw)).toBe(expected);
  });

  it("keeps non-Latin scripts intact", () => {
    expect(normalizeDescription("星巴克 咖啡")).toBe("星巴克 咖啡");
    expect(normalizeDescription("スターバックス")).toBe("スターバックス");
    expect(normalizeDescription("스타벅스")).toBe("스타벅스");
    expect(normalizeDescription("مقهى")).toBe("مقهى");
    expect(normalizeDescription("चाय")).toBe("चाय");
    expect(normalizeDescription("Кофе")).toBe("кофе");
  });

  it("keeps emoji as their own tokens and drops joiners and variation selectors", () => {
    expect(normalizeDescription("☕coffee")).toBe("☕ coffee");
    expect(normalizeDescription("🍕🍕 night")).toBe("🍕 🍕 night");
    expect(tokenize(normalizeDescription("🛍️ haul"))).toEqual(["🛍", "haul"]);
    const zwj = String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb);
    expect(normalizeDescription(zwj)).toBe(`${String.fromCodePoint(0x1f469)} ${String.fromCodePoint(0x1f4bb)}`);
  });

  it("reduces numbers and symbols alone to nothing", () => {
    expect(normalizeDescription("1234")).toBe("");
    expect(normalizeDescription("$$$")).toBe("");
    expect(normalizeDescription("")).toBe("");
    expect(normalizeDescription("   ")).toBe("");
  });

  it("is idempotent", () => {
    const fixtures = [
      "SQ *BLUE BOTTLE 0423",
      "TST* Joe's Diner #12",
      "AMZN Mktp US*2K3AB45",
      "Café Crème ☕",
      "星巴克 咖啡",
      "🛍️ haul",
      "UBER *EATS",
      "Barnes & Noble",
      "a*b*c",
      "sq *sq *sq *x",
    ];
    for (const raw of fixtures) {
      const once = normalizeDescription(raw);
      expect(normalizeDescription(once)).toBe(once);
    }
  });

  it("stays fast and bounded on adversarial input", () => {
    const inputs = [
      "a".repeat(1_000_000),
      "#".repeat(100_000) + "1",
      " *".repeat(50_000),
      "sq *".repeat(50_000),
      "1a".repeat(50_000),
      "🍕".repeat(100_000),
      "á".repeat(100_000),
      "&".repeat(100_000),
    ];
    for (const raw of inputs) {
      const start = performance.now();
      const out = normalizeDescription(raw);
      expect(performance.now() - start).toBeLessThan(50);
      expect(out.length).toBeLessThanOrEqual(MAX_INPUT_CHARS * 2);
    }
  });
});

describe("isUninformative", () => {
  it.each(["", "x", "misc", "Misc.", "stuff", "misc stuff", "test", "TEST", "n/a", "1234", "$$$", "other", "?"])(
    "rejects %s",
    (raw) => {
      expect(isUninformative(normalizeDescription(raw))).toBe(true);
    },
  );

  it.each(["uber", "rent", "misc uber", "bp", "咖啡"])("accepts %s", (raw) => {
    expect(isUninformative(normalizeDescription(raw))).toBe(false);
  });
});
