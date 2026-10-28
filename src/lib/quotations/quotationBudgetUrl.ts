import { INVOICES_PATH } from '../taskboard/driveConstants';
import {
  INVOICE_BUDGET_QUERY_KEY,
  INVOICE_KIND_QUERY_KEY,
  INVOICE_ID_QUERY_KEY,
} from '../invoices/invoiceDocumentKindUrl';

export { INVOICE_BUDGET_QUERY_KEY };

export function parseBudgetIdFromQuery(param: string | null): string | null {
  const raw = param?.trim();
  return raw || null;
}

/** Share link to a project budget on the Quotations tab. */
export function quotationBudgetShareUrl(
  budgetId: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set(INVOICE_KIND_QUERY_KEY, 'quotation');
  params.set(INVOICE_BUDGET_QUERY_KEY, budgetId);
  params.delete(INVOICE_ID_QUERY_KEY);
  return `${base}${INVOICES_PATH}?${params.toString()}`;
}
