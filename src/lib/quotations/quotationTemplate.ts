import type { QuotationDraft, QuotationLineInput } from './types';
import templateJson from './vrInstallationBudgetTemplate.json';
import { recomputeQuotationLines } from './quotationBudgetCalc';

type TemplateJson = {
  template_id: string;
  title_placeholder: string;
  subtitle: string;
  day_rate: number;
  contingency_rate: number;
  currency: string;
  lines: QuotationLineInput[];
};

const VR_TEMPLATE = templateJson as TemplateJson;

export function listQuotationTemplates() {
  return [
    {
      id: VR_TEMPLATE.template_id,
      label: 'VR installation budget (Headlight template)',
      description: 'Based on the Jägermeister VR budget structure: labour, materials, allowances, and totals.',
    },
  ];
}

export function draftFromTemplate(
  projectId: string,
  projectName: string,
  templateId = VR_TEMPLATE.template_id,
): QuotationDraft {
  if (templateId !== VR_TEMPLATE.template_id) {
    throw new Error('Unknown quotation template.');
  }

  const lines = VR_TEMPLATE.lines.map((line, index) => ({
    ...line,
    sort_order: index,
    timeline_entry_id: null,
  }));

  const contingency = VR_TEMPLATE.contingency_rate ?? 0.075;
  const computed = recomputeQuotationLines(lines, contingency);

  return {
    project_id: projectId,
    title: `Budget — ${projectName}`,
    subtitle: VR_TEMPLATE.subtitle,
    currency: VR_TEMPLATE.currency,
    day_rate: VR_TEMPLATE.day_rate,
    contingency_rate: contingency,
    template_id: VR_TEMPLATE.template_id,
    lines: computed,
  };
}
