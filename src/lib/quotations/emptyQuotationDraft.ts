import { recomputeQuotationLines } from './quotationBudgetCalc';
import type { QuotationDraft, QuotationLineInput } from './types';

function summaryFooter(): QuotationLineInput[] {
  return [
    { kind: 'summary', label: 'Total labour', summary_key: 'total_labour', sort_order: 0 },
    { kind: 'summary', label: 'Total materials', summary_key: 'total_materials', sort_order: 0 },
    { kind: 'summary', label: 'Subtotal', summary_key: 'subtotal', sort_order: 0 },
    { kind: 'summary', label: 'Contingency', summary_key: 'contingency', sort_order: 0 },
    {
      kind: 'summary',
      label: 'Subtotal incl. contingency',
      summary_key: 'subtotal_with_contingency',
      sort_order: 0,
    },
    { kind: 'summary', label: 'Subtotal allowances', summary_key: 'total_allowances', sort_order: 0 },
    { kind: 'summary', label: 'TOTAL excl. VAT', summary_key: 'grand_total', sort_order: 0 },
    { kind: 'summary', label: 'Total person-days', summary_key: 'total_person_days', sort_order: 0 },
  ];
}

function emptySectionBlock(sectionCategory: QuotationLineInput['section_category']): QuotationLineInput[] {
  return [
    { kind: 'section', label: '', section_category: sectionCategory, sort_order: 0 },
    {
      kind: 'line',
      label: '',
      notes: '',
      unit_price: null,
      quantity: null,
      section_category: sectionCategory,
      sort_order: 0,
    },
    { kind: 'subtotal', label: 'Subtotal', section_category: sectionCategory, sort_order: 0 },
  ];
}

function reindexLines(lines: QuotationLineInput[]): QuotationLineInput[] {
  return lines.map((line, index) => ({ ...line, sort_order: index }));
}

/** Blank budget: empty title/fields, renameable section headers, no pre-filled costs. */
export function draftEmptyQuotation(projectId: string): QuotationDraft {
  const contingency = 0.075;
  const body = [...emptySectionBlock('other'), ...summaryFooter()];
  const lines = recomputeQuotationLines(reindexLines(body), contingency);

  return {
    project_id: projectId,
    title: '',
    subtitle: '',
    currency: 'EUR',
    day_rate: null,
    contingency_rate: contingency,
    template_id: null,
    lines,
  };
}

export function firstSummaryIndex(lines: QuotationLineInput[]): number {
  return lines.findIndex((line) => line.kind === 'summary');
}

export function addEmptySection(lines: QuotationLineInput[]): QuotationLineInput[] {
  const at = firstSummaryIndex(lines);
  const insertAt = at < 0 ? lines.length : at;
  const block = emptySectionBlock('other');
  const next = [...lines.slice(0, insertAt), ...block, ...lines.slice(insertAt)];
  return reindexLines(next);
}

/** Insert a blank line at the end of the section that contains `afterIndex`. */
export function addEmptyLineAfter(lines: QuotationLineInput[], afterIndex: number): QuotationLineInput[] {
  let sectionCategory = lines[afterIndex]?.section_category ?? 'other';
  for (let i = afterIndex; i >= 0; i -= 1) {
    if (lines[i].kind === 'section') {
      sectionCategory = lines[i].section_category ?? sectionCategory;
      break;
    }
  }

  let insertAt = afterIndex + 1;
  for (let i = afterIndex + 1; i < lines.length; i += 1) {
    if (lines[i].kind === 'subtotal' || lines[i].kind === 'section' || lines[i].kind === 'summary') {
      insertAt = i;
      break;
    }
    insertAt = i + 1;
  }

  const line: QuotationLineInput = {
    kind: 'line',
    label: '',
    notes: '',
    unit_price: null,
    quantity: null,
    section_category: sectionCategory,
    sort_order: insertAt,
  };

  const next = [...lines.slice(0, insertAt), line, ...lines.slice(insertAt)];
  return reindexLines(next);
}
