import { CATEGORIES } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { orderedColumns, type ColumnDef } from "../columns";
import { PdfDocument, type PdfPage, type RGB } from "../pdf/PdfDocument";
import type { ExportColumn, ExportDataset, ExportWriter } from "../types";

// US Letter, portrait.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 36;
const BODY_BOTTOM = PAGE_H - 64;
const ROW_H = 20;
const CELL_PAD = 8;

const INK: RGB = [15, 23, 42];
const BODY: RGB = [51, 65, 85];
const MUTED: RGB = [100, 116, 139];
const RULE: RGB = [226, 232, 240];
const ZEBRA: RGB = [248, 250, 252];
const HEADER_FILL: RGB = [241, 245, 249];
const BRAND: RGB = [38, 72, 224];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Relative column widths; they are scaled to fill the page for whichever columns are selected.
const COLUMN_WEIGHT: Record<ExportColumn, number> = { date: 84, category: 104, amount: 84, description: 244 };

function periodLabel({ options, summary }: ExportDataset): string {
  const { from, to } = options;
  if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Through ${formatDate(to)}`;
  if (summary.firstDate && summary.lastDate) return `All dates (${formatDate(summary.firstDate)} – ${formatDate(summary.lastDate)})`;
  return "All dates";
}

function filterLabel({ options }: ExportDataset): string {
  const parts = [
    options.categories.length === CATEGORIES.length ? "All categories" : options.categories.join(", "),
  ];
  if (options.keyword.trim()) parts.push(`Matching “${options.keyword.trim()}”`);
  return parts.join("  •  ");
}

function generatedLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

class ReportLayout {
  readonly doc = new PdfDocument(PAGE_W, PAGE_H);
  page!: PdfPage;
  y = 0;

  constructor(private readonly continuedTitle: string) {
    this.newPage(true);
  }

  newPage(first = false) {
    this.page = this.doc.addPage();
    this.y = MARGIN;
    if (!first) {
      this.page.text(this.continuedTitle, MARGIN, this.y + 10, { size: 9, style: "bold", color: MUTED });
      this.y += 26;
    }
  }

  /** Starts a new page when the next block of the given height wouldn't fit. */
  ensure(height: number): boolean {
    if (this.y + height <= BODY_BOTTOM) return false;
    this.newPage();
    return true;
  }
}

function drawHeader(l: ReportLayout, ds: ExportDataset) {
  const p = l.page;
  p.rect(MARGIN, l.y, 28, 4, BRAND);
  p.text("LEDGERLY", MARGIN, l.y + 22, { size: 9, style: "bold", color: BRAND });
  p.text(`Generated ${generatedLabel(ds.generatedAt)}`, MARGIN + CONTENT_W, l.y + 22, { size: 9, color: MUTED, align: "right" });
  p.text("Expense report", MARGIN, l.y + 52, { size: 24, style: "bold", color: INK });
  p.text(periodLabel(ds), MARGIN, l.y + 72, { size: 11, color: BODY }, CONTENT_W);
  p.text(filterLabel(ds), MARGIN, l.y + 88, { size: 9, color: MUTED }, CONTENT_W);
  l.y += 104;
}

function drawSummaryTiles(l: ReportLayout, ds: ExportDataset) {
  const gap = 12;
  const w = (CONTENT_W - gap * 3) / 4;
  const h = 54;
  const s = ds.summary;
  const tiles: [string, string][] = [
    ["EXPENSES", s.count.toLocaleString("en-US")],
    ["TOTAL", formatCurrency(s.total)],
    ["AVERAGE", formatCurrency(s.average)],
    ["CATEGORIES", String(s.byCategory.length)],
  ];
  tiles.forEach(([label, value], i) => {
    const x = MARGIN + i * (w + gap);
    l.page.rect(x, l.y, w, h, ZEBRA);
    l.page.rect(x, l.y, 3, h, i === 1 ? BRAND : RULE);
    l.page.text(label, x + 14, l.y + 20, { size: 7.5, style: "bold", color: MUTED });
    l.page.text(value, x + 14, l.y + 41, { size: 15, style: "bold", color: INK }, w - 22);
  });
  l.y += h + 28;
}

function sectionTitle(l: ReportLayout, title: string, note?: string) {
  l.ensure(ROW_H * 3);
  l.page.text(title, MARGIN, l.y + 12, { size: 12, style: "bold", color: INK });
  if (note) l.page.text(note, MARGIN + CONTENT_W, l.y + 12, { size: 9, color: MUTED, align: "right" });
  l.y += 22;
}

function drawCategoryBreakdown(l: ReportLayout, ds: ExportDataset) {
  if (ds.summary.byCategory.length === 0) return;
  sectionTitle(l, "By category");

  const cols = { name: MARGIN + CELL_PAD, count: MARGIN + 220, total: MARGIN + 320, share: MARGIN + 380, bar: MARGIN + 396 };
  const barW = CONTENT_W - (cols.bar - MARGIN) - CELL_PAD;
  const header = () => {
    l.page.rect(MARGIN, l.y, CONTENT_W, ROW_H, HEADER_FILL);
    const h = { size: 7.5, style: "bold" as const, color: MUTED };
    l.page.text("CATEGORY", cols.name, l.y + 13, h);
    l.page.text("EXPENSES", cols.count, l.y + 13, { ...h, align: "right" });
    l.page.text("TOTAL", cols.total, l.y + 13, { ...h, align: "right" });
    l.page.text("SHARE", cols.share - 34, l.y + 13, h);
    l.y += ROW_H;
  };
  header();

  for (const c of ds.summary.byCategory) {
    if (l.ensure(ROW_H)) header();
    const mid = l.y + 13.5;
    const color = hexToRgb(CATEGORY_META[c.category].color);
    l.page.rect(cols.name, l.y + 6.5, 8, 8, color);
    l.page.text(c.category, cols.name + 14, mid, { size: 9.5, color: INK });
    l.page.text(String(c.count), cols.count, mid, { size: 9.5, color: BODY, align: "right" });
    l.page.text(formatCurrency(c.total), cols.total, mid, { size: 9.5, style: "bold", color: INK, align: "right" });
    l.page.text(formatPercent(c.share), cols.share, mid, { size: 9.5, color: BODY, align: "right" });
    l.page.rect(cols.bar, l.y + 8, barW, 5, RULE);
    l.page.rect(cols.bar, l.y + 8, Math.max(1, barW * c.share), 5, color);
    l.page.line(MARGIN, l.y + ROW_H, MARGIN + CONTENT_W, l.y + ROW_H, RULE, 0.5);
    l.y += ROW_H;
  }
  l.y += 26;
}

function cellText(col: ColumnDef, e: ExportDataset["rows"][number]): string {
  if (col.key === "date") return formatDate(e.date);
  if (col.key === "amount") return formatCurrency(e.amount);
  return col.text(e);
}

function drawTransactions(l: ReportLayout, ds: ExportDataset) {
  const columns = orderedColumns(ds.options.columns);
  const weight = columns.reduce((sum, c) => sum + COLUMN_WEIGHT[c.key], 0);
  let x = MARGIN;
  const layout = columns.map((col) => {
    const width = (COLUMN_WEIGHT[col.key] / weight) * CONTENT_W;
    const cell = { col, x, width };
    x += width;
    return cell;
  });
  const anchor = (c: (typeof layout)[number]) => (c.col.align === "right" ? c.x + c.width - CELL_PAD : c.x + CELL_PAD);

  sectionTitle(l, "Transactions", `${ds.rows.length.toLocaleString("en-US")} ${ds.rows.length === 1 ? "expense" : "expenses"}`);

  const header = () => {
    l.page.rect(MARGIN, l.y, CONTENT_W, ROW_H, HEADER_FILL);
    for (const c of layout) {
      l.page.text(c.col.label.toUpperCase(), anchor(c), l.y + 13, { size: 7.5, style: "bold", color: MUTED, align: c.col.align });
    }
    l.y += ROW_H;
  };
  header();

  if (ds.rows.length === 0) {
    l.page.text("No expenses match these filters.", MARGIN + CELL_PAD, l.y + 16, { size: 9.5, color: MUTED });
    l.y += ROW_H + 4;
    return;
  }

  ds.rows.forEach((e, i) => {
    if (l.ensure(ROW_H)) header();
    if (i % 2 === 1) l.page.rect(MARGIN, l.y, CONTENT_W, ROW_H, ZEBRA);
    for (const c of layout) {
      l.page.text(
        cellText(c.col, e),
        anchor(c),
        l.y + 13.5,
        { size: 9, color: c.col.key === "amount" ? INK : BODY, align: c.col.align },
        c.width - CELL_PAD * 2,
      );
    }
    l.y += ROW_H;
  });

  // Totals row, aligned under the amount column when it is shown.
  l.ensure(ROW_H + 4);
  l.page.line(MARGIN, l.y, MARGIN + CONTENT_W, l.y, INK, 1);
  const amount = layout.find((c) => c.col.key === "amount");
  l.page.text("Total", MARGIN + CELL_PAD, l.y + 15, { size: 9.5, style: "bold", color: INK });
  l.page.text(formatCurrency(ds.summary.total), amount ? anchor(amount) : MARGIN + CONTENT_W - CELL_PAD, l.y + 15, {
    size: 9.5,
    style: "bold",
    color: INK,
    align: "right",
  });
  l.y += ROW_H + 4;
}

function drawFooters(doc: PdfDocument, ds: ExportDataset) {
  const total = doc.pages.length;
  doc.pages.forEach((p, i) => {
    p.line(MARGIN, FOOTER_Y - 12, MARGIN + CONTENT_W, FOOTER_Y - 12, RULE, 0.5);
    p.text(`Ledgerly expense report • ${periodLabel(ds)}`, MARGIN, FOOTER_Y, { size: 8, color: MUTED }, CONTENT_W - 90);
    p.text(`Page ${i + 1} of ${total}`, MARGIN + CONTENT_W, FOOTER_Y, { size: 8, color: MUTED, align: "right" });
  });
}

export const writePdf: ExportWriter = (ds) => {
  const layout = new ReportLayout(`Expense report (continued) • ${periodLabel(ds)}`);
  drawHeader(layout, ds);
  drawSummaryTiles(layout, ds);
  drawCategoryBreakdown(layout, ds);
  drawTransactions(layout, ds);
  drawFooters(layout.doc, ds);
  const bytes = layout.doc.toBytes({ title: `Expense report – ${periodLabel(ds)}`, createdAt: ds.generatedAt });
  return new Blob([bytes], { type: "application/pdf" });
};
