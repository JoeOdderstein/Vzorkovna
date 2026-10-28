export type QuotationLineKind = 'section' | 'line' | 'subtotal' | 'summary';

export type QuotationSectionCategory = 'labour' | 'materials' | 'proposed' | 'allowance' | 'other';

export type QuotationSummaryKey =
  | 'total_labour'
  | 'total_materials'
  | 'subtotal'
  | 'contingency'
  | 'subtotal_with_contingency'
  | 'total_allowances'
  | 'grand_total'
  | 'total_person_days';

export type QuotationLineInput = {
  id?: string;
  kind: QuotationLineKind;
  label: string;
  notes?: string;
  unit_price?: number | null;
  quantity?: number | null;
  total?: number | null;
  section_category?: QuotationSectionCategory | null;
  summary_key?: QuotationSummaryKey | null;
  timeline_entry_id?: string | null;
  sort_order: number;
};

export type ProjectQuotation = {
  id: string;
  project_id: string;
  title: string;
  subtitle: string;
  currency: string;
  day_rate: number | null;
  contingency_rate: number | null;
  template_id: string | null;
  source_invoice_id: string | null;
  created_by: string;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: QuotationLineRecord[];
  project?: { id: string; name: string };
};

export type QuotationLineRecord = QuotationLineInput & {
  id: string;
  quotation_id: string;
};

export type QuotationDraft = {
  project_id: string;
  title: string;
  subtitle: string;
  currency: string;
  day_rate: number | null;
  contingency_rate: number | null;
  template_id: string | null;
  lines: QuotationLineInput[];
};
