/** Pre-selected notifyee when uploading an invoice (login username). */
export const DEFAULT_INVOICE_NOTIFY_USERNAME = 'pasha';

export type InvoiceDocumentKind = 'invoice' | 'receipt' | 'quotation';

export const INVOICE_DOCUMENT_KINDS: InvoiceDocumentKind[] = [
  'invoice',
  'receipt',
  'quotation',
];
