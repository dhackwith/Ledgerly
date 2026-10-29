/**
 * Text normalization shared by every layer of the suggester (plan 3.2).
 * Pure and linear-time: none of these regexes has nested or overlapping
 * quantifiers, and input is cut to MAX_INPUT_CHARS before any work.
 */

/** Descriptions are validated to 120 chars, but imports may not be, so cut early. */
export const MAX_INPUT_CHARS = 200;

const LATIN_MARKS = /[\u0300-\u036f]/g;
const INVISIBLE = /[\u200b-\u200d\u2060\ufe0e\ufe0f]/g;
/**
 * Payment-processor prefixes such as "sq *", "tst*", "pp*", "paypal *". A fixed list, because
 * merchants use the same shape ("uber *eats"), where the part before "*" is the merchant.
 */
const CARD_PREFIX = /^(?:sq|sqc|tst|pp|paypal|sp|py|dd|ic|wpy|bt|fs) ?\*+ */;
/** Store numbers such as "#0423" or "# 12". */
const STORE_NUMBER = /#\s*\d+/g;
const APOSTROPHES = /['`\u2018\u2019]/g;
// Unicode property escapes go through RegExp() because tsconfig sets no ES target.
const PICTOGRAPH = new RegExp("(\\p{Extended_Pictographic})", "gu");
/** Everything that is not a letter, digit, mark, pictograph or "&" separates tokens. */
const SEPARATORS = new RegExp("[^\\p{L}\\p{N}\\p{M}\\p{Extended_Pictographic}&]+", "gu");
const DIGIT = new RegExp("\\p{N}", "u");
const LETTER = new RegExp("\\p{L}", "u");

/** Bank-statement filler that says nothing about the merchant. */
const NOISE_TOKENS = new Set([
  "pos", "debit", "checkcard", "visa", "mastercard", "ach", "purchase",
  "inc", "llc", "ltd", "corp", "com", "www", "&",
]);

/** Generic words that never justify a suggestion on their own (plan 6.1). */
export const STOPLIST: ReadonlySet<string> = new Set([
  "misc", "miscellaneous", "stuff", "thing", "things", "test", "testing", "x", "xx", "xxx",
  "item", "items", "expense", "expenses", "payment", "other", "others", "na", "none",
  "idk", "various", "general", "random", "asdf", "todo", "tbd", "unknown", "sundry", "sundries",
  "something", "etc", "spent", "money", "cost", "costs",
]);

function keepToken(token: string): boolean {
  if (!token || NOISE_TOKENS.has(token)) return false;
  let digits = 0;
  for (const ch of token) if (DIGIT.test(ch)) digits++;
  // Store numbers, reference IDs and long digit runs ("0423", "2k3ab45") are noise.
  if (digits >= 3) return false;
  if (digits >= 2 && token.length >= 5 && LETTER.test(token)) return false;
  return true;
}

/**
 * Lowercased, accent-free, noise-free form of a description, with single
 * spaces between tokens. Idempotent. Works for any script.
 */
export function normalizeDescription(raw: string): string {
  const s = raw
    .slice(0, MAX_INPUT_CHARS)
    .toLowerCase()
    .normalize("NFKD")
    .replace(LATIN_MARKS, "")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .trim()
    .replace(CARD_PREFIX, "")
    .replace(STORE_NUMBER, " ")
    .replace(APOSTROPHES, "")
    .replace(PICTOGRAPH, " $1 ")
    .replace(SEPARATORS, " ");
  return s.split(" ").filter(keepToken).join(" ");
}

export function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(" ") : [];
}

/** True when the text is too short or too generic to suggest from. */
export function isUninformative(normalized: string): boolean {
  if (normalized.length < 2) return true;
  // Lone ASCII letters or digits ("n a", "x 2") carry no merchant signal either.
  return tokenize(normalized).every((t) => STOPLIST.has(t) || /^[a-z0-9]$/.test(t));
}
