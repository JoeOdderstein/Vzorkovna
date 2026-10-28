/**
 * Import a Headlight-style budget .xlsx into project_quotations.
 *
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/import-quotation-xlsx.ts <path.xlsx> [project-slug]
 */
import { readFileSync } from 'fs';
import { getSupabaseAdmin } from '../api/_lib/supabaseAdmin.js';
import { parseBudgetXlsxToDraft } from '../src/lib/quotations/parseBudgetXlsx.ts';
import { recomputeQuotationLines } from '../src/lib/quotations/quotationBudgetCalc.ts';
import type { QuotationLineInput } from '../src/lib/quotations/types.ts';

const filePath = process.argv[2];
const projectSlug = process.argv[3] ?? 'jagermeister-room';

if (!filePath) {
  console.error('Usage: import-quotation-xlsx.ts <path.xlsx> [project-slug]');
  process.exit(1);
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

async function main() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const { data: project, error: projectError } = await sb
    .from('projects')
    .select('id, name')
    .eq('slug', projectSlug)
    .maybeSingle();

  if (projectError || !project) {
    console.error(`Project not found for slug: ${projectSlug}`);
    process.exit(1);
  }

  const buffer = readFileSync(filePath).buffer;
  const draft = parseBudgetXlsxToDraft(buffer, project.id, project.name);
  draft.template_id = 'vr_installation_budget';

  const { data: existing } = await sb
    .from('project_quotations')
    .select('id, title')
    .eq('project_id', project.id)
    .ilike('title', draft.title.trim())
    .maybeSingle();

  if (existing) {
    console.log(`Skip: quotation already exists — ${existing.title} (${existing.id})`);
    return;
  }

  const createdBy =
    process.env.TASKBOARD_ADMIN_USERNAME?.trim().toLowerCase() ||
    process.env.TASKBOARD_USERNAME?.trim().toLowerCase() ||
    'admin';

  const contingency = draft.contingency_rate ?? 0.075;
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
      created_by: createdBy,
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

  console.log(`Created: ${created.title} → ${quotationId} (${lines.length} lines, total ${grand} EUR)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
