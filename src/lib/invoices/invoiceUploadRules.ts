import type { InvoiceDocumentKind } from './constants';
import { isPdfFile } from '../installations/installationDocumentService';

export const MAX_INVOICE_FILE_BYTES = 25 * 1024 * 1024;

/** File input `accept` for quotation uploads (PDF + common office formats). */
export const QUOTATION_UPLOAD_ACCEPT =
  '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

const QUOTATION_EXTENSIONS = new Set([
  'pdf',
  'xlsx',
  'xls',
  'csv',
  'doc',
  'docx',
  'ppt',
  'pptx',
]);

const QUOTATION_MIME_PREFIXES = ['application/vnd.', 'application/msword', 'text/csv'];

export function fileExtension(name: string): string {
  const lower = name.trim().toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0 || dot === lower.length - 1) return '';
  return lower.slice(dot + 1);
}

export function isQuotationUploadFile(file: File): boolean {
  if (isPdfFile(file)) return true;
  const ext = fileExtension(file.name);
  if (ext && QUOTATION_EXTENSIONS.has(ext)) return true;
  const type = file.type.toLowerCase();
  if (type && QUOTATION_MIME_PREFIXES.some((p) => type.startsWith(p) || type === p)) {
    return true;
  }
  return false;
}

export function validateInvoiceUploadFile(
  file: File,
  documentKind: InvoiceDocumentKind,
): string | null {
  if (file.size > MAX_INVOICE_FILE_BYTES) {
    return 'File must be 25 MB or smaller.';
  }
  if (documentKind === 'quotation') {
    if (!isQuotationUploadFile(file)) {
      return 'Please choose a PDF, Excel, Word, PowerPoint, or CSV file.';
    }
    return null;
  }
  if (!isPdfFile(file)) {
    return 'Please choose a PDF file.';
  }
  return null;
}

export function sanitizeInvoiceFileName(name: string, fallback: string): string {
  const ext = fileExtension(name);
  const stem = name.replace(/\.[^.]+$/, '').trim() || fallback;
  const safeStem = stem.replace(/[^\w.-]+/g, '-').slice(0, 120);
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 8);
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

export function invoiceStoragePathForFile(file: File): string {
  const safeName = sanitizeInvoiceFileName(file.name, 'document');
  return `invoices/${Date.now()}-${safeName}`;
}

export function uploadContentTypeForFile(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = fileExtension(file.name);
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return byExt[ext] ?? 'application/octet-stream';
}

export function isInvoicePdfStoragePath(storagePath: string): boolean {
  return /\.pdf$/i.test(storagePath.trim());
}
