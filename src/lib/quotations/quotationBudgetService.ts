import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from '../taskboard/config';
import { recomputeQuotationLines } from './quotationBudgetCalc';
import type { ProjectQuotation, QuotationDraft, QuotationLineInput, QuotationLineRecord } from './types';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapLine(row: Record<string, unknown>): QuotationLineRecord {
  return {
    id: String(row.id),
    quotation_id: String(row.quotation_id),
    kind: row.kind as QuotationLineRecord['kind'],
    label: String(row.label ?? ''),
    notes: String(row.notes ?? ''),
    unit_price: numOrNull(row.unit_price),
    quantity: numOrNull(row.quantity),
    total: numOrNull(row.total),
    section_category: (row.section_category as QuotationLineRecord['section_category']) ?? null,
    summary_key: (row.summary_key as QuotationLineRecord['summary_key']) ?? null,
    timeline_entry_id: row.timeline_entry_id ? String(row.timeline_entry_id) : null,
    sort_order: Number(row.sort_order ?? 0),
  };
}

function mapQuotation(row: Record<string, unknown>, lines: QuotationLineRecord[] = []): ProjectQuotation {
  const project = row.projects as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ''),
    subtitle: String(row.subtitle ?? ''),
    currency: String(row.currency ?? 'EUR'),
    day_rate: numOrNull(row.day_rate),
    contingency_rate: numOrNull(row.contingency_rate),
    template_id: row.template_id ? String(row.template_id) : null,
    source_invoice_id: row.source_invoice_id ? String(row.source_invoice_id) : null,
    created_by: String(row.created_by ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    lines,
    project: project
      ? { id: String(project.id), name: String(project.name ?? '') }
      : undefined,
  };
}

export async function listProjectQuotations(): Promise<ProjectQuotation[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await (await db())
    .from('project_quotations')
    .select('*, projects(id, name), project_quotation_lines(*)')
    .order('updated_at', { ascending: false });

  if (error) {
    if (/project_quotations|relation|schema cache/i.test(error.message)) {
      throw new Error(
        'Run supabase/migrations/043_project_quotations.sql in Supabase to enable editable budgets.',
      );
    }
    throw error;
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const rawLines = record.project_quotation_lines;
    const lineRows = Array.isArray(rawLines) ? rawLines : [];
    delete record.project_quotation_lines;
    return mapQuotation(
      record,
      lineRows
        .map((line) => mapLine(line as Record<string, unknown>))
        .sort((a, b) => a.sort_order - b.sort_order),
    );
  });
}

export async function fetchProjectQuotation(id: string): Promise<ProjectQuotation> {
  const { data: head, error: headError } = await (await db())
    .from('project_quotations')
    .select('*, projects(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (headError) throw headError;
  if (!head) throw new Error('Quotation not found.');

  const { data: lines, error: linesError } = await (await db())
    .from('project_quotation_lines')
    .select('*')
    .eq('quotation_id', id)
    .order('sort_order', { ascending: true });

  if (linesError) throw linesError;

  return mapQuotation(
    head as Record<string, unknown>,
    (lines ?? []).map((row) => mapLine(row as Record<string, unknown>)),
  );
}

function lineToRow(quotationId: string, line: QuotationLineInput) {
  return {
    quotation_id: quotationId,
    sort_order: line.sort_order,
    kind: line.kind,
    label: line.label,
    notes: line.notes ?? '',
    unit_price: line.unit_price,
    quantity: line.quantity,
    total: line.total,
    section_category: line.section_category ?? null,
    summary_key: line.summary_key ?? null,
    timeline_entry_id: line.timeline_entry_id ?? null,
  };
}

export async function createProjectQuotation(
  draft: QuotationDraft,
  createdBy: string,
): Promise<ProjectQuotation> {
  const contingency = draft.contingency_rate ?? 0.075;
  const lines = recomputeQuotationLines(draft.lines, contingency);

  const { data: created, error } = await (await db())
    .from('project_quotations')
    .insert({
      project_id: draft.project_id,
      title: draft.title.trim(),
      subtitle: draft.subtitle ?? '',
      currency: draft.currency || 'EUR',
      day_rate: draft.day_rate,
      contingency_rate: draft.contingency_rate,
      template_id: draft.template_id,
      created_by: createdBy.trim().toLowerCase(),
    })
    .select('*, projects(id, name)')
    .single();

  if (error) throw error;

  const quotationId = String(created.id);
  const { error: linesError } = await (await db())
    .from('project_quotation_lines')
    .insert(lines.map((line) => lineToRow(quotationId, line)));

  if (linesError) {
    await (await db()).from('project_quotations').delete().eq('id', quotationId);
    throw linesError;
  }

  return fetchProjectQuotation(quotationId);
}

export async function saveProjectQuotation(
  quotationId: string,
  draft: Omit<QuotationDraft, 'project_id'> & { project_id?: string },
): Promise<ProjectQuotation> {
  const contingency = draft.contingency_rate ?? 0.075;
  const lines = recomputeQuotationLines(draft.lines, contingency);

  const { error: headError } = await (await db())
    .from('project_quotations')
    .update({
      title: draft.title.trim(),
      subtitle: draft.subtitle ?? '',
      currency: draft.currency || 'EUR',
      day_rate: draft.day_rate,
      contingency_rate: draft.contingency_rate,
      ...(draft.project_id ? { project_id: draft.project_id } : {}),
    })
    .eq('id', quotationId);

  if (headError) throw headError;

  const { error: deleteError } = await (await db())
    .from('project_quotation_lines')
    .delete()
    .eq('quotation_id', quotationId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await (await db())
    .from('project_quotation_lines')
    .insert(lines.map((line) => lineToRow(quotationId, line)));

  if (insertError) throw insertError;

  return fetchProjectQuotation(quotationId);
}

export async function deleteProjectQuotation(id: string): Promise<void> {
  const { error } = await (await db()).from('project_quotations').delete().eq('id', id);
  if (error) throw error;
}

function duplicateBudgetTitle(sourceTitle: string): string {
  const base = sourceTitle.trim() || 'Budget';
  if (/ \(copy\)$/i.test(base)) return base.replace(/ \(copy\)$/i, ' (copy 2)');
  const numbered = / \(copy (\d+)\)$/i.exec(base);
  if (numbered) {
    const n = Number(numbered[1]) + 1;
    return base.replace(/ \(copy \d+\)$/i, ` (copy ${n})`);
  }
  return `${base} (copy)`;
}

/** Clone an editable budget (new row + lines). Does not copy `source_invoice_id`. */
export async function duplicateProjectQuotation(
  sourceId: string,
  createdBy: string,
): Promise<ProjectQuotation> {
  const source = await fetchProjectQuotation(sourceId);
  const lines: QuotationLineInput[] = (source.lines ?? []).map(
    ({ kind, label, notes, unit_price, quantity, total, section_category, summary_key, timeline_entry_id, sort_order }) => ({
      kind,
      label,
      notes,
      unit_price,
      quantity,
      total,
      section_category,
      summary_key,
      timeline_entry_id,
      sort_order,
    }),
  );

  const draft: QuotationDraft = {
    project_id: source.project_id,
    title: duplicateBudgetTitle(source.title),
    subtitle: source.subtitle,
    currency: source.currency,
    day_rate: source.day_rate,
    contingency_rate: source.contingency_rate,
    template_id: source.template_id,
    lines,
  };

  return createProjectQuotation(draft, createdBy);
}
