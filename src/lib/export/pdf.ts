import type { Expense } from "@/lib/types";
import { sumAmounts, totalsByCategory, type CategoryTotal } from "@/lib/analytics";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { PdfDocument, type PdfPage, type RGB } from "./pdf-writer";
import { COLUMN_LABELS, resolveColumns, type ExportColumn, type ExportOptions } from "./types";

export const PDF_TITLE = "Ledgerly expense export";

// US Letter, portrait. All sizes in points.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_BOTTOM = PAGE_H - 64;
const FOOTER_Y = PAGE_H - 36;
const ROW_H = 20;
const CELL_PAD = 8;

const INK: RGB = [15, 23, 42];
const BODY: RGB = [51, 65, 85];
const MUTED: RGB = [100, 116, 139];
const RULE: RGB = [226, 232, 240];
const ZEBRA: RGB = [248, 250, 252];
const HEADER_FILL: RGB = [241, 245, 249];
const BRAND: RGB = [38, 72, 224];

// Relative column widths; they are scaled to fill the page for whichever columns are selected.
const COLUMN_WEIGHT: Record<ExportColumn, number> = { date: 90, category: 104, description: 238, amount: 84 };
const COLUMN_ALIGN: Record<ExportColumn, "left" | "right"> = { date: "left", category: "left", description: "left", amount: "right" };

const CELL_TEXT: Record<ExportColumn, (e: Expense) => string> = {
  date: (e) => formatDate(e.date),
  category: (e) => e.category,
  description: (e) => e.description,
  amount: (e) => formatCurrency(e.amount),
};

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function generatedLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function dateRangeLabel(expenses: Expense[]): string {
  if (expenses.length === 0) return "No expenses";
  let first = expenses[0].date;
  let last = first;
  for (const e of expenses) {
    if (e.date < first) first = e.date;
    if (e.date > last) last = e.date;
  }
  return first === last ? formatDate(first) : `${formatDate(first)} – ${formatDate(last)}`;
}

/** Tracks the current page and the y position of the next block, starting new pages as content runs out. */
class ReportLayout {
  readonly doc = new PdfDocument(PAGE_W, PAGE_H);
  page!: PdfPage;
  y = 0;

  constructor() {
    this.newPage(true);
  }

  newPage(first = false): void {
    this.page = this.doc.addPage();
    this.y = MARGIN;
    if (!first) {
      this.page.text(`${PDF_TITLE} (continued)`, MARGIN, this.y + 10, { size: 9, style: "bold", color: MUTED });
      this.y += 26;
    }
  }

  /** Starts a new page when a block of the given height wouldn't fit. Returns true when it did. */
  ensure(height: number): boolean {
    if (this.y + height <= BODY_BOTTOM) return false;
    this.newPage();
    return true;
  }
}

function drawHeader(l: ReportLayout, expenses: Expense[], now: Date): void {
  const p = l.page;
  p.rect(MARGIN, l.y, 28, 4, BRAND);
  p.text("LEDGERLY", MARGIN, l.y + 22, { size: 9, style: "bold", color: BRAND });
  p.text(`Generated ${generatedLabel(now)}`, MARGIN + CONTENT_W, l.y + 22, { size: 9, color: MUTED, align: "right" });
  p.text(PDF_TITLE, MARGIN, l.y + 50, { size: 22, style: "bold", color: INK });
  const count = `${expenses.length.toLocaleString("en-US")} ${expenses.length === 1 ? "expense" : "expenses"}`;
  p.text(`${count}  •  ${dateRangeLabel(expenses)}  •  Total ${formatCurrency(sumAmounts(expenses))}`, MARGIN, l.y + 70, {
    size: 10.5,
    color: BODY,
  });
  l.y += 92;
}

function sectionTitle(l: ReportLayout, title: string): void {
  l.ensure(ROW_H * 3);
  l.page.text(title, MARGIN, l.y + 12, { size: 12, style: "bold", color: INK });
  l.y += 22;
}

function drawSummary(l: ReportLayout, totals: CategoryTotal[]): void {
  sectionTitle(l, "Summary by category");
  const col = { name: MARGIN + CELL_PAD, count: MARGIN + 220, total: MARGIN + 320, share: MARGIN + 380, bar: MARGIN + 396 };
  const barW = CONTENT_W - (col.bar - MARGIN) - CELL_PAD;

  const header = () => {
    l.page.rect(MARGIN, l.y, CONTENT_W, ROW_H, HEADER_FILL);
    const h = { size: 7.5, style: "bold" as const, color: MUTED };
    l.page.text("CATEGORY", col.name, l.y + 13, h);
    l.page.text("EXPENSES", col.count, l.y + 13, { ...h, align: "right" });
    l.page.text("TOTAL", col.total, l.y + 13, { ...h, align: "right" });
    l.page.text("SHARE", col.share, l.y + 13, { ...h, align: "right" });
    l.y += ROW_H;
  };
  header();

  if (totals.length === 0) {
    l.page.text("No expenses to summarize.", col.name, l.y + 13.5, { size: 9.5, color: MUTED });
    l.y += ROW_H;
  }

  for (const c of totals) {
    if (l.ensure(ROW_H)) header();
    const mid = l.y + 13.5;
    const color = hexToRgb(CATEGORY_META[c.category].color);
    l.page.rect(col.name, l.y + 6.5, 8, 8, color);
    l.page.text(c.category, col.name + 14, mid, { size: 9.5, color: INK });
    l.page.text(String(c.count), col.count, mid, { size: 9.5, color: BODY, align: "right" });
    l.page.text(formatCurrency(c.total), col.total, mid, { size: 9.5, style: "bold", color: INK, align: "right" });
    l.page.text(formatPercent(c.share), col.share, mid, { size: 9.5, color: BODY, align: "right" });
    l.page.rect(col.bar, l.y + 8, barW, 5, RULE);
    l.page.rect(col.bar, l.y + 8, Math.max(1, barW * c.share), 5, color);
    l.page.line(MARGIN, l.y + ROW_H, MARGIN + CONTENT_W, l.y + ROW_H, RULE, 0.5);
    l.y += ROW_H;
  }
  l.y += 26;
}

function drawExpenses(l: ReportLayout, expenses: Expense[], columns: ExportColumn[]): void {
  const weight = columns.reduce((sum, c) => sum + COLUMN_WEIGHT[c], 0);
  let x = MARGIN;
  const cells = columns.map((key) => {
    const width = (COLUMN_WEIGHT[key] / weight) * CONTENT_W;
    const cell = { key, x, width, align: COLUMN_ALIGN[key] };
    x += width;
    return cell;
  });
  const anchor = (c: (typeof cells)[number]) => (c.align === "right" ? c.x + c.width - CELL_PAD : c.x + CELL_PAD);

  sectionTitle(l, "Expenses");

  const header = () => {
    l.page.rect(MARGIN, l.y, CONTENT_W, ROW_H, HEADER_FILL);
    for (const c of cells) {
      l.page.text(COLUMN_LABELS[c.key].toUpperCase(), anchor(c), l.y + 13, { size: 7.5, style: "bold", color: MUTED, align: c.align });
    }
    l.y += ROW_H;
  };
  header();

  if (expenses.length === 0) {
    l.page.text("No expenses to export.", MARGIN + CELL_PAD, l.y + 13.5, { size: 9.5, color: MUTED });
    l.y += ROW_H;
  }

  expenses.forEach((e, i) => {
    // The last row moves to the next page together with the total so the total never sits alone.
    const needed = i === expenses.length - 1 ? ROW_H * 2 + 4 : ROW_H;
    if (l.ensure(needed)) header();
    if (i % 2 === 1) l.page.rect(MARGIN, l.y, CONTENT_W, ROW_H, ZEBRA);
    for (const c of cells) {
      const style = { size: 9, color: c.key === "amount" ? INK : BODY, align: c.align };
      l.page.text(CELL_TEXT[c.key](e), anchor(c), l.y + 13.5, style, c.width - CELL_PAD * 2);
    }
    l.y += ROW_H;
  });

  // Grand total, aligned under the amount column when it is shown.
  l.ensure(ROW_H + 4);
  l.page.line(MARGIN, l.y, MARGIN + CONTENT_W, l.y, INK, 1);
  const amount = cells.find((c) => c.key === "amount");
  const totalX = amount ? anchor(amount) : MARGIN + CONTENT_W - CELL_PAD;
  l.page.text("Total", MARGIN + CELL_PAD, l.y + 15, { size: 9.5, style: "bold", color: INK });
  l.page.text(formatCurrency(sumAmounts(expenses)), totalX, l.y + 15, { size: 9.5, style: "bold", color: INK, align: "right" });
  l.y += ROW_H + 4;
}

function drawFooters(doc: PdfDocument): void {
  const total = doc.pages.length;
  doc.pages.forEach((p, i) => {
    p.line(MARGIN, FOOTER_Y - 12, MARGIN + CONTENT_W, FOOTER_Y - 12, RULE, 0.5);
    p.text(PDF_TITLE, MARGIN, FOOTER_Y, { size: 8, color: MUTED });
    p.text(`Page ${i + 1} of ${total}`, MARGIN + CONTENT_W, FOOTER_Y, { size: 8, color: MUTED, align: "right" });
  });
}

/** Renders the report and returns the PDF file bytes. */
export function buildPDF(
  expenses: Expense[],
  options: Pick<ExportOptions, "includeSummary" | "columns">,
  now = new Date(),
): Uint8Array {
  const layout = new ReportLayout();
  drawHeader(layout, expenses, now);
  if (options.includeSummary) drawSummary(layout, totalsByCategory(expenses));
  drawExpenses(layout, expenses, resolveColumns(options.columns));
  drawFooters(layout.doc);
  return layout.doc.toBytes({ title: PDF_TITLE, createdAt: now });
}
