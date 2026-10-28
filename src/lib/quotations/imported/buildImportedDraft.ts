import { recomputeQuotationLines } from '../quotationBudgetCalc';
import type { QuotationDraft, QuotationLineInput, QuotationSectionCategory } from '../types';

export type ImportedLineSpec = {
  label: string;
  notes?: string;
  unit_price: number | null;
  quantity: number | null;
  category?: QuotationSectionCategory;
};

export type ImportedPartSpec = {
  subLabel: string;
  category: QuotationSectionCategory;
  lines: ImportedLineSpec[];
  subtotalLabel: string;
};

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

function reindexLines(lines: QuotationLineInput[]): QuotationLineInput[] {
  return lines.map((line, index) => ({ ...line, sort_order: index }));
}

export function buildImportedQuotationDraft(input: {
  project_id: string;
  title: string;
  subtitle: string;
  currency?: string;
  day_rate?: number | null;
  contingency_rate?: number | null;
  template_id?: string | null;
  source_invoice_id?: string | null;
  sections: { heading: string; parts: ImportedPartSpec[] }[];
}): QuotationDraft & { source_invoice_id?: string | null } {
  const body: QuotationLineInput[] = [];

  for (const section of input.sections) {
    body.push({
      kind: 'section',
      label: section.heading,
      section_category: 'other',
      sort_order: 0,
    });
    for (const part of section.parts) {
      body.push({
        kind: 'section',
        label: part.subLabel,
        section_category: part.category,
        sort_order: 0,
      });
      for (const line of part.lines) {
        body.push({
          kind: 'line',
          label: line.label,
          notes: line.notes ?? '',
          unit_price: line.unit_price,
          quantity: line.quantity,
          section_category: line.category ?? part.category,
          sort_order: 0,
        });
      }
      body.push({
        kind: 'subtotal',
        label: part.subtotalLabel,
        section_category: part.category,
        sort_order: 0,
      });
    }
  }

  const contingency = input.contingency_rate ?? 0;
  const lines = recomputeQuotationLines(reindexLines([...body, ...summaryFooter()]), contingency);

  return {
    project_id: input.project_id,
    title: input.title,
    subtitle: input.subtitle,
    currency: input.currency ?? 'EUR',
    day_rate: input.day_rate ?? null,
    contingency_rate: contingency,
    template_id: input.template_id ?? null,
    source_invoice_id: input.source_invoice_id ?? null,
    lines,
  };
}
