// A minimal PDF 1.4 writer: text in the standard Helvetica fonts, filled rectangles and lines.
// That is all a tabular report needs, and it keeps the app free of a PDF dependency.
// Coordinates passed to the drawing methods are in points from the TOP-left corner of the page.

export type FontStyle = "regular" | "bold";
export type RGB = readonly [number, number, number];

export interface TextStyle {
  size?: number;
  style?: FontStyle;
  color?: RGB;
  align?: "left" | "right" | "center";
}

// ---------------------------------------------------------------------------
// Font metrics
// ---------------------------------------------------------------------------

// Glyph widths for Helvetica and Helvetica-Bold in 1/1000 em, for codes 32 (space) through 126 ("~").
// Every PDF reader ships these fonts, so nothing has to be embedded.
// prettier-ignore
const REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// prettier-ignore
const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Widths for the WinAnsi punctuation range 0x80-0x9F that differ from the fallback width.
// prettier-ignore
const HIGH_WIDTHS: Record<number, number> = {
  0x82: 222, 0x84: 333, 0x85: 1000, 0x88: 333, 0x89: 1000, 0x8b: 333, 0x8c: 1000,
  0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x97: 1000, 0x98: 333,
  0x99: 1000, 0x9b: 333, 0x9c: 944,
};

// Unicode characters that WinAnsiEncoding places in 0x80-0x9F (curly quotes, dashes, the euro sign, ...).
// prettier-ignore
const WIN_ANSI_SPECIALS: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// Emoji with their joiners and skin-tone modifiers. Dropping them loses nothing a report needs.
// Built from a string because the tsconfig has no ES2018 target; every supported browser handles the "u" flag.
const EMOJI = new RegExp("[\\p{Extended_Pictographic}\\u{1F3FB}-\\u{1F3FF}\\u200d\\ufe0e\\ufe0f]", "gu");

const ELLIPSIS = String.fromCharCode(0x85);

/** Width of one WinAnsi-encoded byte in 1/1000 em. */
function glyphWidth(code: number, style: FontStyle): number {
  if (code >= 32 && code <= 126) return (style === "bold" ? BOLD_WIDTHS : REGULAR_WIDTHS)[code - 32];
  return HIGH_WIDTHS[code] ?? 556;
}

/**
 * Converts text to WinAnsi bytes, held as a string of char codes 0-255.
 * Emoji are dropped. Characters the standard fonts can't draw, such as CJK, become "?".
 */
export function toWinAnsi(text: string): string {
  const cleaned = text.replace(/[\r\n\t]+/g, " ").replace(EMOJI, "").replace(/ {2,}/g, " ");
  let out = "";
  for (const ch of cleaned) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    if ((cp >= 32 && cp <= 126) || (cp >= 0xa0 && cp <= 0xff)) out += ch;
    else if (WIN_ANSI_SPECIALS[cp]) out += String.fromCharCode(WIN_ANSI_SPECIALS[cp]);
    else out += "?";
  }
  return out;
}

/** Width in points of already-encoded WinAnsi text. */
function encodedWidth(encoded: string, style: FontStyle, size: number): number {
  let units = 0;
  for (let i = 0; i < encoded.length; i++) units += glyphWidth(encoded.charCodeAt(i), style);
  return (units * size) / 1000;
}

/** Measures text in points. */
export function measureText(text: string, size: number, style: FontStyle = "regular"): number {
  return encodedWidth(toWinAnsi(text), style, size);
}

// ---------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function rgb([r, g, b]: RGB): string {
  return `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;
}

function escapePdfString(encoded: string): string {
  return encoded.replace(/[\\()]/g, (c) => `\\${c}`);
}

export class PdfPage {
  readonly ops: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** Draws one line of text with its baseline at y. Text wider than maxWidth is cut with an ellipsis. */
  text(
    value: string,
    x: number,
    y: number,
    { size = 10, style = "regular", color = [0, 0, 0], align = "left" }: TextStyle = {},
    maxWidth?: number,
  ): void {
    let encoded = toWinAnsi(value);
    if (maxWidth !== undefined && encodedWidth(encoded, style, size) > maxWidth) {
      const room = maxWidth - encodedWidth(ELLIPSIS, style, size);
      while (encoded.length > 0 && encodedWidth(encoded, style, size) > room) encoded = encoded.slice(0, -1);
      encoded = encoded.trimEnd() + ELLIPSIS;
    }
    const width = encodedWidth(encoded, style, size);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    const font = style === "bold" ? "F2" : "F1";
    this.ops.push(
      `BT /${font} ${num(size)} Tf ${rgb(color)} rg ${num(left)} ${num(this.height - y)} Td (${escapePdfString(encoded)}) Tj ET`,
    );
  }

  /** Fills a rectangle whose top-left corner is at (x, y). */
  rect(x: number, y: number, w: number, h: number, fill: RGB): void {
    this.ops.push(`${rgb(fill)} rg ${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB, width = 0.75): void {
    this.ops.push(
      `${num(width)} w ${rgb(color)} RG ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S`,
    );
  }
}

export interface DocumentInfo {
  title: string;
  createdAt: Date;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `D:${stamp}${sign}${p(Math.floor(abs / 60))}'${p(abs % 60)}'`;
}

// Object numbers are fixed: 1 catalog, 2 page tree, 3-4 fonts, 5 info, then a page + content stream pair per page.
const FIRST_PAGE_OBJECT = 6;

export class PdfDocument {
  readonly pages: PdfPage[] = [];

  constructor(
    readonly pageWidth = 612,
    readonly pageHeight = 792,
  ) {}

  addPage(): PdfPage {
    const page = new PdfPage(this.pageWidth, this.pageHeight);
    this.pages.push(page);
    return page;
  }

  /** Serializes the document. Every character of the intermediate string is one byte (0-255). */
  toBytes(info: DocumentInfo): Uint8Array {
    const objects: string[] = [];
    const pageIds = this.pages.map((_, i) => FIRST_PAGE_OBJECT + i * 2);

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    objects[5] =
      `<< /Title (${escapePdfString(toWinAnsi(info.title))}) /Producer (Ledgerly) ` +
      `/CreationDate (${pdfDate(info.createdAt)}) >>`;

    this.pages.forEach((page, i) => {
      const pageId = pageIds[i];
      const stream = page.ops.join("\n");
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.pageWidth)} ${num(this.pageHeight)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    // The second line is the conventional binary marker so transfer tools treat the file as binary.
    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefAt = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
    return bytes;
  }
}
