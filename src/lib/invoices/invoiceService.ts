import { isPdfFile } from '../installations/installationDocumentService';
import { isSupabaseConfigured } from '../taskboard/config';
import { getAttachmentUrl } from '../taskboard/taskService';
import { ensureSupabaseSession, getSupabase } from '../supabase';

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type InvoiceRecord = {
  id: string;
  title: string;
  storage_path: string;
  uploaded_by: string;
  forwarded_to_finance: boolean;
  forwarded_to_finance_by: string | null;
  forwarded_to_finance_at: string | null;
  payment_received: boolean;
  payment_received_by: string | null;
  payment_received_at: string | null;
  created_at: string;
  updated_at: string;
};

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapInvoice(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    storage_path: String(row.storage_path ?? ''),
    uploaded_by: String(row.uploaded_by ?? ''),
    forwarded_to_finance: Boolean(row.forwarded_to_finance),
    forwarded_to_finance_by: row.forwarded_to_finance_by ? String(row.forwarded_to_finance_by) : null,
    forwarded_to_finance_at: row.forwarded_to_finance_at ? String(row.forwarded_to_finance_at) : null,
    payment_received: Boolean(row.payment_received),
    payment_received_by: row.payment_received_by ? String(row.payment_received_by) : null,
    payment_received_at: row.payment_received_at ? String(row.payment_received_at) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function sanitizePdfFileName(name: string) {
  const base = name.replace(/\.pdf$/i, '').trim() || 'invoice';
  return base.replace(/[^\w.-]+/g, '-').slice(0, 120);
}

export async function listInvoices(): Promise<InvoiceRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await db();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('List invoices failed:', error);
    throw new Error('Could not load invoices.');
  }

  return (data ?? []).map((row) => mapInvoice(row as Record<string, unknown>));
}

export async function uploadInvoicePdf(file: File, uploadedBy: string): Promise<InvoiceRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Upload requires Supabase to be connected.');
  }
  if (!uploadedBy.trim()) {
    throw new Error('You must be logged in to upload an invoice.');
  }
  if (!isPdfFile(file)) {
    throw new Error('Please choose a PDF file.');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 25 MB or smaller.');
  }

  const title = sanitizePdfFileName(file.name);
  const path = `invoices/${Date.now()}-${title}.pdf`;
  const supabase = await db();

  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(path, file, { upsert: false, contentType: 'application/pdf' });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      title,
      storage_path: path,
      uploaded_by: uploadedBy.trim().toLowerCase(),
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from('task-attachments').remove([path]);
    throw error;
  }

  return mapInvoice(data as Record<string, unknown>);
}

export async function getInvoicePdfUrl(storagePath: string): Promise<string> {
  return getAttachmentUrl(storagePath);
}

export type InvoiceStatusPatch = {
  forwarded_to_finance?: boolean;
  payment_received?: boolean;
};

export async function updateInvoiceStatus(
  invoiceId: string,
  patch: InvoiceStatusPatch,
  actorUsername: string,
): Promise<InvoiceRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Updates require Supabase.');
  }

  const actor = actorUsername.trim().toLowerCase();
  if (!actor) throw new Error('You must be logged in to update an invoice.');

  const payload: Record<string, unknown> = {};

  if (patch.forwarded_to_finance !== undefined) {
    payload.forwarded_to_finance = patch.forwarded_to_finance;
    if (patch.forwarded_to_finance) {
      payload.forwarded_to_finance_by = actor;
      payload.forwarded_to_finance_at = new Date().toISOString();
    } else {
      payload.forwarded_to_finance_by = null;
      payload.forwarded_to_finance_at = null;
    }
  }

  if (patch.payment_received !== undefined) {
    payload.payment_received = patch.payment_received;
    if (patch.payment_received) {
      payload.payment_received_by = actor;
      payload.payment_received_at = new Date().toISOString();
    } else {
      payload.payment_received_by = null;
      payload.payment_received_at = null;
    }
  }

  const supabase = await db();
  const { data, error } = await supabase
    .from('invoices')
    .update(payload)
    .eq('id', invoiceId)
    .select('*')
    .single();

  if (error) throw error;
  return mapInvoice(data as Record<string, unknown>);
}

export async function deleteInvoice(invoiceId: string, actorUsername: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Deletes require Supabase.');
  }

  const actor = actorUsername.trim().toLowerCase();
  if (!actor) throw new Error('You must be logged in to delete an invoice.');

  const supabase = await db();

  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id, storage_path, uploaded_by')
    .eq('id', invoiceId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) throw new Error('Invoice not found.');
  if (String(existing.uploaded_by).toLowerCase() !== actor) {
    throw new Error('You can only delete invoices you uploaded.');
  }

  const storagePath = String(existing.storage_path ?? '');

  const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoiceId);

  if (deleteError) throw deleteError;

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from('task-attachments')
      .remove([storagePath]);
    if (storageError) {
      console.warn('Invoice row deleted but PDF removal failed:', storageError);
    }
  }
}
