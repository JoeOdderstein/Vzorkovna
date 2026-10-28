import * as XLSX from 'xlsx';
import type { QuotationDraft, QuotationLineInput, QuotationSectionCategory } from './types';
import { recomputeQuotationLines } from './quotationBudgetCalc';

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function classifySection(label: string): QuotationSectionCategory | 'subtotal' | null {
  const u = label.toUpperCase();
  if (u.startsWith('LABOUR')) return 'labour';
  if (u.startsWith('MATERIALS')) return 'materials';
  if (u.startsWith('PROPOSED')) return 'proposed';
  if (u.startsWith('ALLOWANCES')) return 'allowance';
  if (label.toLowerCase().startsWith('subtotal')) return 'subtotal';
  return null;
}

const SUMMARY_KEYS = {
  'Total labour': 'total_labour',
  'Total materials': 'total_materials',
  Subtotal: 'subtotal',
  Contingency: 'contingency',
  'Subtotal incl. contingency': 'subtotal_with_contingency',
  'Subtotal allowances': 'total_allowances',
  'TOTAL excl. VAT': 'grand_total',
  'Total person-days': 'total_person_days',
} as const;

/** Parse a Headlight-style budget workbook (sheet 1) into an editable quotation draft. */
export function parseBudgetXlsxToDraft(
  buffer: ArrayBuffer,
  projectId: string,
  projectName: string,
): QuotationDraft {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Workbook has no sheets.');

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const title = str(rows[0]?.[0]) || `Budget — ${projectName}`;
  const subtitle = str(rows[1]?.[0]) ?? '';
  let dayRate: number | null = null;
  let contingencyRate: number | null = null;

  for (let r = 0; r < Math.min(rows.length, 8); r += 1) {
    const label = str(rows[r]?.[0]).toLowerCase();
    if (label.includes('day rate')) dayRate = num(rows[r]?.[2]);
    if (label.includes('contingency')) contingencyRate = num(rows[r]?.[2]);
  }

  const lines: QuotationLineInput[] = [];
  let sort = 0;
  let currentCategory: QuotationSectionCategory | null = null;

  for (let r = 8; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const a = str(row[0]);
    if (!a) continue;

    const notes = str(row[1]) || undefined;
    const unit = num(row[2]);
    const qty = num(row[3]);
    const totalCell = num(row[4]);

    const hint = classifySection(a);
    if (hint === 'subtotal') {
      lines.push({
        kind: 'subtotal',
        label: a,
        notes,
        section_category: currentCategory,
        sort_order: sort,
      });
      sort += 1;
      continue;
    }
    if (hint === 'labour' || hint === 'materials' || hint === 'proposed' || hint === 'allowance') {
      currentCategory = hint;
      lines.push({
        kind: 'section',
        label: a,
        section_category: currentCategory,
        sort_order: sort,
      });
      sort += 1;
      continue;
    }

    const summaryKey = SUMMARY_KEYS[a as keyof typeof SUMMARY_KEYS];
    if (summaryKey) {
      lines.push({
        kind: 'summary',
        label: a,
        summary_key: summaryKey,
        total: totalCell,
        sort_order: sort,
      });
      sort += 1;
      continue;
    }

    const total =
      totalCell ?? (unit != null && qty != null ? Math.round(unit * qty * 100) / 100 : null);
    lines.push({
      kind: 'line',
      label: a,
      notes,
      unit_price: unit,
      quantity: qty,
      total,
      section_category: currentCategory,
      sort_order: sort,
    });
    sort += 1;
  }

  if (lines.length === 0) {
    throw new Error('No budget rows found. Use the Headlight budget layout (item / notes / price / qty / total).');
  }

  const contingency = contingencyRate ?? 0.075;
  const computed = recomputeQuotationLines(lines, contingency);

  return {
    project_id: projectId,
    title,
    subtitle,
    currency: 'EUR',
    day_rate: dayRate,
    contingency_rate: contingency,
    template_id: null,
    lines: computed,
  };
}
