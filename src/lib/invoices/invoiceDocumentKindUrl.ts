import { INVOICES_PATH } from '../taskboard/driveConstants';
import type { InvoiceDocumentKind } from './constants';

export const INVOICE_KIND_QUERY_KEY = 'kind';
export const INVOICE_ID_QUERY_KEY = 'id';
export const INVOICE_BUDGET_QUERY_KEY = 'budget';

export function parseInvoiceKindFromQuery(param: string | null): InvoiceDocumentKind {
  const raw = param?.trim().toLowerCase();
  if (raw === 'receipt' || raw === 'quotation' || raw === 'invoice') return raw;
  return 'invoice';
}

export function parseInvoiceIdFromQuery(param: string | null): string | null {
  const raw = param?.trim();
  return raw || null;
}

export function invoiceDocumentKindQueryValue(kind: InvoiceDocumentKind): string | null {
  if (kind === 'invoice') return null;
  return kind;
}

export function invoiceDocumentShareUrl(
  invoice: { id: string; document_kind: InvoiceDocumentKind },
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams();
  if (invoice.document_kind !== 'invoice') {
    params.set(INVOICE_KIND_QUERY_KEY, invoice.document_kind);
  }
  params.set(INVOICE_ID_QUERY_KEY, invoice.id);
  return `${base}${INVOICES_PATH}?${params.toString()}`;
}
