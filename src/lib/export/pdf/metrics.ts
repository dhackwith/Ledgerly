// Glyph widths for the standard PDF fonts Helvetica and Helvetica-Bold, in 1/1000 em.
// Every PDF reader ships these fonts, so nothing has to be embedded.
// Index 0 is the space character (code 32); the tables run through "~" (code 126).

// prettier-ignore
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// prettier-ignore
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Widths for the WinAnsi punctuation range 0x80-0x9F that differ from the default.
const HIGH_WIDTHS: Record<number, number> = {
  0x82: 222, 0x84: 333, 0x85: 1000, 0x88: 333, 0x89: 1000, 0x8b: 333, 0x8c: 1000,
  0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x97: 1000, 0x98: 333,
  0x99: 1000, 0x9b: 333, 0x9c: 944,
};

export type FontStyle = "regular" | "bold";

/** Width of one WinAnsi-encoded byte in 1/1000 em. */
export function glyphWidth(code: number, style: FontStyle): number {
  if (code >= 32 && code <= 126) return (style === "bold" ? BOLD : REGULAR)[code - 32];
  return HIGH_WIDTHS[code] ?? 556;
}

// Unicode characters that WinAnsiEncoding places in 0x80-0x9F.
const WIN_ANSI_SPECIALS: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// Emoji and their joiners and modifiers. They carry no meaning a reader would miss in a report.
// Built from a string because tsconfig has no ES2018 target; every supported browser handles the "u" flag.
const EMOJI = new RegExp("[\\p{Extended_Pictographic}\\u{1F3FB}-\\u{1F3FF}\\u200d\\ufe0e\\ufe0f]", "gu");

/**
 * Converts text to WinAnsi bytes, held as a string of char codes 0-255.
 * Emoji are dropped. Other characters the standard fonts can't draw, such as CJK, become "?".
 */
export function toWinAnsi(text: string): string {
  const cleaned = text.replace(/[\r\n\t]+/g, " ").replace(EMOJI, "").replace(/ {2,}/g, " ");
  let out = "";
  for (const ch of cleaned) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 32 && cp <= 126) || (cp >= 0xa0 && cp <= 0xff)) out += ch;
    else if (WIN_ANSI_SPECIALS[cp]) out += String.fromCharCode(WIN_ANSI_SPECIALS[cp]);
    else out += "?";
  }
  return out;
}

/** Width in points of already-encoded WinAnsi text. */
export function encodedWidth(encoded: string, style: FontStyle, size: number): number {
  let units = 0;
  for (let i = 0; i < encoded.length; i++) units += glyphWidth(encoded.charCodeAt(i), style);
  return (units * size) / 1000;
}
