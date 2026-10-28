// A minimal PDF 1.4 writer: text in the standard Helvetica fonts, filled rectangles and lines.
// That is all a tabular report needs, and it keeps the app free of a large PDF dependency.
// Coordinates passed to the drawing methods are in points from the TOP-left corner.

import { encodedWidth, toWinAnsi, type FontStyle } from "./metrics";

export type RGB = readonly [number, number, number];

export interface TextStyle {
  size?: number;
  style?: FontStyle;
  color?: RGB;
  align?: "left" | "right" | "center";
}

const ELLIPSIS = String.fromCharCode(0x85);

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function rgb([r, g, b]: RGB): string {
  return `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;
}

function escapePdfString(encoded: string): string {
  return encoded.replace(/[\\()]/g, (c) => `\\${c}`);
}

/** Measures text in points. */
export function measure(text: string, size: number, style: FontStyle = "regular"): number {
  return encodedWidth(toWinAnsi(text), style, size);
}

export class PdfPage {
  readonly ops: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** Draws one line of text with its baseline at y. Text wider than maxWidth is cut with an ellipsis. */
  text(value: string, x: number, y: number, { size = 10, style = "regular", color = [0, 0, 0], align = "left" }: TextStyle = {}, maxWidth?: number) {
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

  rect(x: number, y: number, w: number, h: number, fill: RGB) {
    this.ops.push(`${rgb(fill)} rg ${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB, width = 0.75) {
    this.ops.push(`${num(width)} w ${rgb(color)} RG ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S`);
  }
}

export interface DocumentInfo {
  title: string;
  author?: string;
  createdAt: Date;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${sign}${p(Math.floor(abs / 60))}'${p(abs % 60)}'`;
}

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

  /** Serializes the document. Every character in the output is one byte (0-255). */
  toBytes(info: DocumentInfo): Uint8Array {
    const objects: string[] = [];
    const pageIds = this.pages.map((_, i) => 6 + i * 2);

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const meta = [
      `/Title (${escapePdfString(toWinAnsi(info.title))})`,
      info.author ? `/Author (${escapePdfString(toWinAnsi(info.author))})` : "",
      "/Producer (Ledgerly)",
      `/CreationDate (${pdfDate(info.createdAt)})`,
    ];
    objects[5] = `<< ${meta.filter(Boolean).join(" ")} >>`;

    this.pages.forEach((page, i) => {
      const pageId = pageIds[i];
      const stream = page.ops.join("\n");
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.pageWidth)} ${num(this.pageHeight)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let out = "%PDF-1.4\n%âãÏÓ\n";
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
