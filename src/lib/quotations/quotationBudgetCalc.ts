import type { QuotationLineInput, QuotationSectionCategory, QuotationSummaryKey } from './types';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function lineTotal(line: QuotationLineInput): number {
  if (line.kind !== 'line') return 0;
  const unit = Number(line.unit_price ?? 0);
  const qty = Number(line.quantity ?? 0);
  return roundMoney(unit * qty);
}

function sumLinesUntil(
  lines: QuotationLineInput[],
  fromIndex: number,
  stopBeforeIndex: number,
): number {
  let sum = 0;
  for (let i = fromIndex; i < stopBeforeIndex; i += 1) {
    const row = lines[i];
    if (row.kind === 'line') sum += lineTotal(row);
  }
  return roundMoney(sum);
}

function findSectionStart(lines: QuotationLineInput[], subtotalIndex: number): number {
  for (let i = subtotalIndex - 1; i >= 0; i -= 1) {
    if (lines[i].kind === 'section') return i;
    if (lines[i].kind === 'subtotal') return i + 1;
  }
  return 0;
}

function subtotalForRow(lines: QuotationLineInput[], index: number): number {
  const start = findSectionStart(lines, index);
  return sumLinesUntil(lines, start + 1, index);
}

function subtotalsByCategory(
  lines: QuotationLineInput[],
  category: QuotationSectionCategory,
): number {
  let sum = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const row = lines[i];
    if (row.kind === 'subtotal' && row.section_category === category) {
      sum += subtotalForRow(lines, i);
    }
  }
  return roundMoney(sum);
}

/** Recompute line totals, subtotals, and summary rows (mutates copy). */
export function recomputeQuotationLines(
  lines: QuotationLineInput[],
  contingencyRate: number,
): QuotationLineInput[] {
  const out = lines.map((row) => ({ ...row }));

  for (const row of out) {
    if (row.kind === 'line') {
      row.total = lineTotal(row);
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    if (out[i].kind === 'subtotal') {
      out[i].total = subtotalForRow(out, i);
    }
  }

  const totalLabour = subtotalsByCategory(out, 'labour');
  const totalMaterials =
    subtotalsByCategory(out, 'materials') +
    subtotalsByCategory(out, 'proposed') +
    subtotalsByCategory(out, 'other');
  const subtotal = roundMoney(totalLabour + totalMaterials);
  const contingency = roundMoney(subtotal * contingencyRate);
  const subtotalWithContingency = roundMoney(subtotal + contingency);

  let totalAllowances = 0;
  for (let i = 0; i < out.length; i += 1) {
    const row = out[i];
    if (row.kind === 'subtotal' && row.section_category === 'allowance') {
      totalAllowances += subtotalForRow(out, i);
    }
  }
  totalAllowances = roundMoney(totalAllowances);

  const grandTotal = roundMoney(subtotalWithContingency + totalAllowances);

  let personDays = 0;
  for (const row of out) {
    if (row.kind === 'line' && row.section_category === 'labour') {
      personDays += Number(row.quantity ?? 0);
    }
  }
  personDays = roundMoney(personDays);

  const summaryValues: Partial<Record<QuotationSummaryKey, number>> = {
    total_labour: totalLabour,
    total_materials: totalMaterials,
    subtotal,
    contingency,
    subtotal_with_contingency: subtotalWithContingency,
    total_allowances: totalAllowances,
    grand_total: grandTotal,
    total_person_days: personDays,
  };

  for (const row of out) {
    if (row.kind === 'summary' && row.summary_key) {
      row.total = summaryValues[row.summary_key] ?? row.total ?? 0;
    }
  }

  return out;
}

export function formatQuotationMoney(value: number | null | undefined, currency = 'EUR'): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
