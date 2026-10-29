import type { QuotationLineInput } from './types';
import { recomputeQuotationLines } from './quotationBudgetCalc';
import { pdfWinAnsiText } from './pdfWinAnsiText';

export type QuotationBudgetPdfMeta = {
  title: string;
  subtitle: string;
  projectName: string;
  currency: string;
  dayRate: number | null;
  contingencyRate: number | null;
  lines: QuotationLineInput[];
  phaseLabelFor: (timelineEntryId: string | null | undefined) => string;
};

function sanitizePdfFilename(title: string): string {
  const base = title.trim() || 'quotation';
  const safe = base
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${safe || 'quotation'}.pdf`;
}

function spaceCurrencySymbol(formatted: string): string {
  return formatted
    .replace(/\u00a0/g, ' ')
    .replace(/([€$£¥])(?=[\d-])/, '$1 ')
    .replace(/(?<=[\d.])([€$£¥])/g, ' $1');
}

function formatMoneyPdf(value: number | null | undefined, currency: string): string {
  if (value == null || Number.isNaN(value)) return '-';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return pdfWinAnsiText(spaceCurrencySymbol(formatted));
}

function formatUnit(value: number | null | undefined, currency: string): string {
  if (value == null || Number.isNaN(value)) return '';
  return formatMoneyPdf(value, currency);
}

function formatQty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(value);
}

type PdfFonts = {
  regular: import('pdf-lib').PDFFont;
  bold: import('pdf-lib').PDFFont;
};

function pushLongWord(
  word: string,
  maxWidth: number,
  font: import('pdf-lib').PDFFont,
  fontSize: number,
  lines: string[],
) {
  if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
    lines.push(word);
    return;
  }
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
  if (chunk) lines.push(chunk);
}

function wrapText(
  text: string,
  maxWidth: number,
  font: import('pdf-lib').PDFFont,
  fontSize: number,
): string[] {
  const words = pdfWinAnsiText(text).trim().split(/\s+/).filter(Boolean);
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
      pushLongWord(word, maxWidth, font, fontSize, lines);
      current = '';
    } else {
      pushLongWord(word, maxWidth, font, fontSize, lines);
    }
  }
  if (current) lines.push(current);
  return lines;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const FONT = 8;
const FONT_SM = 7.5;

/** Baseline-to-baseline step for a given font size (avoids ascender/descender overlap). */
function lineStep(fontSize: number): number {
  return Math.max(11, Math.ceil(fontSize * 1.45));
}

const ROW_PAD_Y = 5;
const SECTION_PAD_Y = 7;
const SUBTOTAL_PAD_TOP = 4;

export async function downloadQuotationBudgetPdf(meta: QuotationBudgetPdfMeta): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const contingency = meta.contingencyRate ?? 0.075;
  const lines = recomputeQuotationLines(
    meta.lines.map((line) => ({ ...line })),
    contingency,
  );

  const pdfDoc = await PDFDocument.create();
  const fonts: PdfFonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const col = {
    phase: MARGIN,
    item: MARGIN + 72,
    notes: MARGIN + 168,
    unit: MARGIN + 318,
    qty: MARGIN + 378,
    total: MARGIN + 428,
  };
  const colW = {
    phase: 64,
    item: 92,
    notes: 146,
    unit: 54,
    qty: 44,
    total: PAGE_W - MARGIN - col.total,
  };

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    font: import('pdf-lib').PDFFont,
    color = rgb(0.12, 0.12, 0.12),
  ) => {
    const safe = pdfWinAnsiText(text);
    if (!safe) return;
    page.drawText(safe, { x, y: yPos, size, font, color });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN + 24) return;
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    drawTableHeader();
  };

  const drawTableHeader = () => {
    y -= 8;
    const headerStep = lineStep(FONT_SM);
    drawText('Phase', col.phase, y, FONT_SM, fonts.bold);
    drawText('Item', col.item, y, FONT_SM, fonts.bold);
    drawText('Notes', col.notes, y, FONT_SM, fonts.bold);
    drawText('Unit', col.unit, y, FONT_SM, fonts.bold);
    drawText('Qty', col.qty, y, FONT_SM, fonts.bold);
    drawText('Total', col.total, y, FONT_SM, fonts.bold);
    y -= headerStep * 0.35;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= headerStep;
  };

  drawText(meta.title.trim() || 'Quotation', MARGIN, y, 16, fonts.bold);
  y -= 18;

  if (meta.subtitle.trim()) {
    const subSize = 9;
    const subStep = lineStep(subSize);
    const subLines = wrapText(meta.subtitle, PAGE_W - MARGIN * 2, fonts.regular, subSize);
    for (const line of subLines) {
      drawText(line, MARGIN, y, subSize, fonts.regular, rgb(0.35, 0.35, 0.35));
      y -= subStep;
    }
  }

  const metaLine = [
    meta.projectName ? `Project: ${meta.projectName}` : '',
    meta.dayRate != null ? `Day rate: ${formatUnit(meta.dayRate, meta.currency)}` : '',
    meta.contingencyRate != null ? `Contingency: ${meta.contingencyRate}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (metaLine) {
    drawText(metaLine, MARGIN, y, FONT_SM, fonts.regular, rgb(0.4, 0.4, 0.4));
    y -= 14;
  }

  y -= 6;
  drawTableHeader();

  const advanceY = (amount: number) => {
    y -= amount;
  };

  for (const row of lines) {
    if (row.kind === 'section') {
      const sectionSize = FONT + 0.5;
      const step = lineStep(sectionSize);
      const sectionLines = wrapText(row.label || '-', PAGE_W - MARGIN * 2 - 8, fonts.bold, sectionSize);
      const innerHeight = (sectionLines.length - 1) * step + sectionSize;
      const blockHeight = SECTION_PAD_Y * 2 + innerHeight;
      ensureSpace(blockHeight + 2);
      advanceY(SECTION_PAD_Y);
      const firstBaseline = y;
      page.drawRectangle({
        x: MARGIN,
        y: firstBaseline - innerHeight - SECTION_PAD_Y + 2,
        width: PAGE_W - MARGIN * 2,
        height: blockHeight,
        color: rgb(0.94, 0.94, 0.94),
      });
      for (let i = 0; i < sectionLines.length; i += 1) {
        drawText(sectionLines[i], MARGIN + 4, firstBaseline - i * step, sectionSize, fonts.bold);
      }
      y = firstBaseline - innerHeight - SECTION_PAD_Y;
      continue;
    }

    if (row.kind === 'subtotal' || row.kind === 'summary') {
      const step = lineStep(FONT);
      const label = row.label || '';
      const totalStr = formatMoneyPdf(row.total, meta.currency);
      const labelLines = wrapText(label, colW.notes + colW.unit + colW.qty - 8, fonts.bold, FONT);
      const innerHeight = (labelLines.length - 1) * step + FONT;
      const blockHeight = SUBTOTAL_PAD_TOP + innerHeight + ROW_PAD_Y;
      ensureSpace(blockHeight);
      advanceY(SUBTOTAL_PAD_TOP);
      const firstBaseline = y;
      for (let i = 0; i < labelLines.length; i += 1) {
        const lineY = firstBaseline - i * step;
        drawText(labelLines[i], col.notes, lineY, FONT, fonts.bold);
        if (i === 0) drawText(totalStr, col.total, lineY, FONT, fonts.bold);
      }
      y = firstBaseline - innerHeight;
      advanceY(ROW_PAD_Y);
      continue;
    }

    if (row.kind !== 'line') continue;

    const phase = meta.phaseLabelFor(row.timeline_entry_id);
    const item = row.label ?? '';
    const notes = row.notes ?? '';
    const unit = formatUnit(row.unit_price, meta.currency);
    const qty = formatQty(row.quantity);
    const totalStr = formatMoneyPdf(row.total, meta.currency);

    const phaseLines = wrapText(phase, colW.phase, fonts.regular, FONT_SM);
    const itemLines = wrapText(item, colW.item, fonts.regular, FONT);
    const noteLines = wrapText(notes, colW.notes, fonts.regular, FONT_SM);
    const rowLines = Math.max(phaseLines.length, itemLines.length, noteLines.length, 1);
    const step = lineStep(FONT);
    const innerHeight = (rowLines - 1) * step + FONT;
    const blockHeight = ROW_PAD_Y * 2 + innerHeight;

    ensureSpace(blockHeight);
    advanceY(ROW_PAD_Y);
    const firstBaseline = y;
    for (let i = 0; i < rowLines; i += 1) {
      const lineY = firstBaseline - i * step;
      if (phaseLines[i]) drawText(phaseLines[i], col.phase, lineY, FONT_SM, fonts.regular, rgb(0.45, 0.45, 0.45));
      if (itemLines[i]) drawText(itemLines[i], col.item, lineY, FONT, fonts.regular);
      if (noteLines[i]) drawText(noteLines[i], col.notes, lineY, FONT_SM, fonts.regular, rgb(0.45, 0.45, 0.45));
      if (i === 0) {
        if (unit) drawText(unit, col.unit, lineY, FONT, fonts.regular);
        if (qty) drawText(qty, col.qty, lineY, FONT, fonts.regular);
        drawText(totalStr, col.total, lineY, FONT, fonts.regular);
      }
    }
    y = firstBaseline - innerHeight;
    advanceY(ROW_PAD_Y);
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizePdfFilename(meta.title);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
