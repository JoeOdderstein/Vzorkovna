/**
 * One-off: create editable budgets from the two quotation PDFs in invoice storage.
 *
 *   node --env-file=.env --import tsx scripts/import-uploaded-quotation-pdfs.ts
 */
import { getSupabaseAdmin } from '../api/_lib/supabaseAdmin.js';
import { recomputeQuotationLines } from '../src/lib/quotations/quotationBudgetCalc.ts';
import { infinityRoomQuotation2026034Draft } from '../src/lib/quotations/imported/infinityRoomQuotation2026034.ts';
import { krakowFeedTheDragonQuotationDraft } from '../src/lib/quotations/imported/krakowFeedTheDragonQuotation.ts';
import type { QuotationLineInput } from '../src/lib/quotations/types.ts';

const INFINITY_INVOICE_ID = '303ff7c9-30c8-428c-8b6f-65ba5cf3cf0f';
const KRAKOW_INVOICE_ID = 'd914cd9f-d6db-4987-bcfb-19aeff07e400';

const PROJECT_INFINITY = '462b8509-bbda-45ff-ada4-7095692b83cd';
const PROJECT_KRAKOW = '31368644-c04d-4641-b213-2def9fd39d18';

type DraftWithSource = ReturnType<typeof infinityRoomQuotation2026034Draft>;

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

async function importDraft(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  draft: DraftWithSource,
  createdBy: string,
) {
  const sourceId = draft.source_invoice_id;
  if (sourceId) {
    const { data: existing } = await sb
      .from('project_quotations')
      .select('id, title')
      .eq('source_invoice_id', sourceId)
      .maybeSingle();
    if (existing) {
      console.log(`Skip (already imported): ${existing.title} → ${existing.id}`);
      return existing.id as string;
    }
  }

  const contingency = draft.contingency_rate ?? 0;
  const lines = recomputeQuotationLines(draft.lines, contingency);
  const grand = lines.find((l) => l.summary_key === 'grand_total')?.total;

  const { data: created, error } = await sb
    .from('project_quotations')
    .insert({
      project_id: draft.project_id,
      title: draft.title.trim(),
      subtitle: draft.subtitle ?? '',
      currency: draft.currency || 'EUR',
      day_rate: draft.day_rate,
      contingency_rate: draft.contingency_rate,
      template_id: draft.template_id,
      source_invoice_id: draft.source_invoice_id ?? null,
      created_by: createdBy.trim().toLowerCase(),
    })
    .select('id, title')
    .single();

  if (error) throw error;

  const quotationId = String(created.id);
  const { error: linesError } = await sb
    .from('project_quotation_lines')
    .insert(lines.map((line) => lineToRow(quotationId, line)));

  if (linesError) {
    await sb.from('project_quotations').delete().eq('id', quotationId);
    throw linesError;
  }

  console.log(`Created: ${created.title} → ${quotationId} (grand total ${grand} EUR)`);
  return quotationId;
}

async function main() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const createdBy =
    process.env.TASKBOARD_ADMIN_USERNAME?.trim().toLowerCase() ||
    process.env.TASKBOARD_USERNAME?.trim().toLowerCase() ||
    'admin';

  const infinity = infinityRoomQuotation2026034Draft(PROJECT_INFINITY, INFINITY_INVOICE_ID);
  const krakow = krakowFeedTheDragonQuotationDraft(PROJECT_KRAKOW, KRAKOW_INVOICE_ID);

  await importDraft(sb, infinity, createdBy);
  await importDraft(sb, krakow, createdBy);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
