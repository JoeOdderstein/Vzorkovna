import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const QR_SIZE_MM = 30;
const PAGE_MARGIN_MM = 15;
const CELL_GAP_MM = 5;
const SECTION_GAP_MM = 8;
const SECTION_TITLE_SIZE = 12;
const LABEL_FONT_SIZE = 7;
const LABEL_LINE_HEIGHT_MM = 3.2;
const QR_LABEL_GAP_MM = 2;
const DOC_TITLE_SIZE = 10;
const GRID_COLUMNS = 4;

export const PRINTABLE_A4_QR_PDF_FILENAME = 'printable a4 qr list.pdf';

function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

export type PrintableQrEntry = {
  name: string;
  pngPath: string;
};

export type PrintableQrSection = {
  title: string;
  entries: PrintableQrEntry[];
};

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          const next = chunk + char;
          if (font.widthOfTextAtSize(next, fontSize) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk = next;
          }
        }
        current = chunk;
      }
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

type LayoutContext = {
  pdfDoc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  pageW: number;
  pageH: number;
  margin: number;
  qrSize: number;
  gap: number;
  colWidth: number;
  cols: number;
  cursorY: number;
  page: PDFPage;
  imageCache: Map<string, PDFImage>;
};

async function ensureSpace(ctx: LayoutContext, neededHeightPt: number): Promise<void> {
  if (ctx.cursorY - neededHeightPt >= ctx.margin) return;

  ctx.page = ctx.pdfDoc.addPage([ctx.pageW, ctx.pageH]);
  ctx.cursorY = ctx.pageH - ctx.margin;
}

async function embedPng(ctx: LayoutContext, pngPath: string): Promise<PDFImage> {
  const cached = ctx.imageCache.get(pngPath);
  if (cached) return cached;
  const pngBytes = await readFile(pngPath);
  const image = await ctx.pdfDoc.embedPng(pngBytes);
  ctx.imageCache.set(pngPath, image);
  return image;
}

async function drawSectionTitle(ctx: LayoutContext, title: string): Promise<void> {
  const blockH = mmToPt(SECTION_GAP_MM + 6);
  await ensureSpace(ctx, blockH);

  ctx.page.drawText(title, {
    x: ctx.margin,
    y: ctx.cursorY - mmToPt(4),
    size: SECTION_TITLE_SIZE,
    font: ctx.fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  const lineY = ctx.cursorY - mmToPt(6);
  ctx.page.drawLine({
    start: { x: ctx.margin, y: lineY },
    end: { x: ctx.pageW - ctx.margin, y: lineY },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.75),
  });

  ctx.cursorY = lineY - mmToPt(SECTION_GAP_MM);
}

function measureCell(
  name: string,
  colWidth: number,
  qrSize: number,
  font: PDFFont,
): { labelLines: string[]; cellHeight: number } {
  const labelLines = wrapText(name, colWidth, font, LABEL_FONT_SIZE);
  const labelHeight = labelLines.length * mmToPt(LABEL_LINE_HEIGHT_MM);
  const cellHeight =
    qrSize + mmToPt(QR_LABEL_GAP_MM) + labelHeight + mmToPt(CELL_GAP_MM);
  return { labelLines, cellHeight };
}

async function drawQrCell(
  ctx: LayoutContext,
  entry: PrintableQrEntry,
  col: number,
  rowTopY: number,
  cellHeight: number,
  labelLines: string[],
): Promise<void> {
  const x = ctx.margin + col * (ctx.colWidth + ctx.gap);
  const qrX = x + (ctx.colWidth - ctx.qrSize) / 2;
  const qrBottomY = rowTopY - ctx.qrSize;

  const image = await embedPng(ctx, entry.pngPath);
  ctx.page.drawImage(image, {
    x: qrX,
    y: qrBottomY,
    width: ctx.qrSize,
    height: ctx.qrSize,
  });

  let labelY = qrBottomY - mmToPt(QR_LABEL_GAP_MM);
  for (const line of labelLines) {
    const lineWidth = ctx.font.widthOfTextAtSize(line, LABEL_FONT_SIZE);
    ctx.page.drawText(line, {
      x: x + (ctx.colWidth - lineWidth) / 2,
      y: labelY - LABEL_FONT_SIZE,
      size: LABEL_FONT_SIZE,
      font: ctx.font,
      color: rgb(0.15, 0.15, 0.15),
    });
    labelY -= mmToPt(LABEL_LINE_HEIGHT_MM);
  }

}

async function layoutSection(ctx: LayoutContext, section: PrintableQrSection): Promise<void> {
  if (section.entries.length === 0) return;

  await drawSectionTitle(ctx, section.title);

  let col = 0;
  let rowTopY = ctx.cursorY;
  let rowMaxHeight = 0;
  const rowCells: {
    entry: PrintableQrEntry;
    col: number;
    cellHeight: number;
    labelLines: string[];
  }[] = [];

  const flushRow = async () => {
    if (rowCells.length === 0) return;
    await ensureSpace(ctx, rowMaxHeight);
    rowTopY = ctx.cursorY;
    for (const cell of rowCells) {
      await drawQrCell(ctx, cell.entry, cell.col, rowTopY, cell.cellHeight, cell.labelLines);
    }
    ctx.cursorY = rowTopY - rowMaxHeight;
    rowCells.length = 0;
    col = 0;
    rowMaxHeight = 0;
  };

  for (const entry of section.entries) {
    const { labelLines, cellHeight } = measureCell(
      entry.name,
      ctx.colWidth,
      ctx.qrSize,
      ctx.font,
    );

    if (col === 0 && cellHeight > 0) {
      await ensureSpace(ctx, cellHeight);
      rowTopY = ctx.cursorY;
    }

    rowCells.push({ entry, col, cellHeight, labelLines });
    rowMaxHeight = Math.max(rowMaxHeight, cellHeight);
    col += 1;

    if (col >= ctx.cols) {
      await flushRow();
    }
  }

  await flushRow();
  ctx.cursorY -= mmToPt(4);
}

/**
 * Lays out QR PNGs at exactly 30×30 mm on A4, grouped by section, with full wrapped titles.
 */
export async function writePrintableA4QrListPdf(
  outPath: string,
  sections: PrintableQrSection[],
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = mmToPt(A4_WIDTH_MM);
  const pageH = mmToPt(A4_HEIGHT_MM);
  const margin = mmToPt(PAGE_MARGIN_MM);
  const qrSize = mmToPt(QR_SIZE_MM);
  const gap = mmToPt(CELL_GAP_MM);
  const usableW = pageW - 2 * margin;
  const cols = GRID_COLUMNS;
  const colWidth = (usableW - (cols - 1) * gap) / cols;

  const firstPage = pdfDoc.addPage([pageW, pageH]);
  const ctx: LayoutContext = {
    pdfDoc,
    font,
    fontBold,
    pageW,
    pageH,
    margin,
    qrSize,
    gap,
    colWidth,
    cols,
    cursorY: pageH - margin,
    page: firstPage,
    imageCache: new Map(),
  };

  firstPage.drawText('Installation QR codes (30 × 30 mm on A4)', {
    x: margin,
    y: ctx.cursorY,
    size: DOC_TITLE_SIZE,
    font: fontBold,
    color: rgb(0.35, 0.35, 0.35),
  });
  ctx.cursorY -= mmToPt(12);

  for (const section of sections) {
    await layoutSection(ctx, section);
  }

  const pdfBytes = await pdfDoc.save();
  await writeFile(outPath, pdfBytes);
}
