import { isSupabaseConfigured } from '../taskboard/config';
import { getAttachmentUrl } from '../taskboard/taskService';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { notifyInstallationsUpdated } from './localInstallationOverrides';
import type { InstallationDocument } from './types';

const MAX_PDF_BYTES = 25 * 1024 * 1024;

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapDocument(row: Record<string, unknown>): InstallationDocument {
  return {
    id: String(row.id),
    installation_id: String(row.installation_id),
    kind: row.kind as InstallationDocument['kind'],
    title: String(row.title ?? ''),
    storage_path: row.storage_path ? String(row.storage_path) : null,
    external_url: row.external_url ? String(row.external_url) : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

function sanitizePdfFileName(name: string) {
  const base = name.replace(/\.pdf$/i, '').trim() || 'document';
  return base.replace(/[^\w.-]+/g, '-').slice(0, 120);
}

export function isPdfFile(file: File) {
  const lower = file.name.toLowerCase();
  return file.type === 'application/pdf' || lower.endsWith('.pdf');
}

export async function getInstallationDocumentUrl(storagePath: string): Promise<string> {
  if (storagePath.startsWith('data:')) return storagePath;
  return getAttachmentUrl(storagePath);
}

export async function uploadTechnicalPdf(
  installationId: string,
  file: File
): Promise<InstallationDocument> {
  if (!isSupabaseConfigured()) {
    throw new Error('PDF upload requires Supabase to be connected.');
  }
  if (!isPdfFile(file)) {
    throw new Error('Please choose a PDF file.');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 25 MB or smaller.');
  }

  const safeName = sanitizePdfFileName(file.name);
  const path = `installations/${installationId}/technical/${Date.now()}-${safeName}.pdf`;

  const supabase = await db();
  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(path, file, { upsert: false, contentType: 'application/pdf' });

  if (uploadError) throw uploadError;

  const { data: existing } = await supabase
    .from('installation_documents')
    .select('sort_order')
    .eq('installation_id', installationId)
    .eq('kind', 'technical')
    .order('sort_order', { ascending: false })
    .limit(1);

  const sort_order =
    (existing?.[0]?.sort_order != null ? Number(existing[0].sort_order) : -1) + 1;

  const { data, error } = await supabase
    .from('installation_documents')
    .insert({
      installation_id: installationId,
      kind: 'technical',
      title: safeName,
      storage_path: path,
      sort_order,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from('task-attachments').remove([path]);
    throw error;
  }

  notifyInstallationsUpdated();
  return mapDocument(data as Record<string, unknown>);
}

export async function deleteInstallationDocument(document: InstallationDocument): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Removing documents requires Supabase to be connected.');
  }

  const supabase = await db();

  if (document.storage_path && !document.storage_path.startsWith('data:')) {
    const { error: storageError } = await supabase.storage
      .from('task-attachments')
      .remove([document.storage_path]);
    if (storageError) {
      console.warn('Storage delete failed:', storageError.message);
    }
  }

  const { error } = await supabase.from('installation_documents').delete().eq('id', document.id);
  if (error) throw error;

  notifyInstallationsUpdated();
}
