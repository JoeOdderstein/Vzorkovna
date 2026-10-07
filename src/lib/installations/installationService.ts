import { isSupabaseConfigured } from '../taskboard/config';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import {
  appendLocalCreatedInstallation,
  loadLocalCreatedInstallations,
} from './localInstallationCreates';
import {
  applyLocalInstallationPatches,
  mergeLocalInstallationPatch,
  notifyInstallationsUpdated,
} from './localInstallationOverrides';
import { INSTALLATION_SEED_RECORDS } from './seedData';
import type {
  InstallationDocument,
  InstallationLifecycleStatus,
  InstallationLocation,
  InstallationRecord,
  InstallationRepair,
} from './types';
import { ensureUniqueSlug, slugifyProjectName } from '../taskboard/projectUtils';

export type CreateInstallationInput = {
  name: string;
  location: InstallationLocation;
  responsible_person?: string | null;
};

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function sortByOrder<T extends { sort_order: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeInstallation(row: Record<string, unknown>): InstallationRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    lifecycle_status: row.lifecycle_status as InstallationRecord['lifecycle_status'],
    operational_status: row.operational_status as InstallationRecord['operational_status'],
    responsible_person: row.responsible_person ? String(row.responsible_person) : null,
    last_inspection_date: row.last_inspection_date ? String(row.last_inspection_date) : null,
    next_maintenance_date: row.next_maintenance_date ? String(row.next_maintenance_date) : null,
    revizni_zprava_available: Boolean(row.revizni_zprava_available),
    remote_url: row.remote_url ? String(row.remote_url) : null,
    location: (row.location as InstallationRecord['location']) ?? 'vzorkovna',
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    documents: [],
    repairs: [],
  };
}

function normalizeDocument(row: Record<string, unknown>): InstallationDocument {
  return {
    id: String(row.id),
    installation_id: String(row.installation_id),
    kind: row.kind as InstallationDocument['kind'],
    title: String(row.title ?? ''),
    storage_path: row.storage_path ? String(row.storage_path) : null,
    external_url: row.external_url ? String(row.external_url) : null,
    repair_id: row.repair_id ? String(row.repair_id) : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

function normalizeRepair(row: Record<string, unknown>): InstallationRepair {
  const kindRaw = row.kind;
  const kind: InstallationRepair['kind'] =
    kindRaw === 'bug_report' ? 'bug_report' : 'repair';
  return {
    id: String(row.id),
    installation_id: String(row.installation_id),
    occurred_on: String(row.occurred_on),
    summary: String(row.summary ?? ''),
    resolved: Boolean(row.resolved),
    notes: String(row.notes ?? ''),
    kind,
    reported_by: row.reported_by ? String(row.reported_by) : null,
    created_at: String(row.created_at ?? ''),
  };
}

function attachRelations(
  installations: InstallationRecord[],
  documents: InstallationDocument[],
  repairs: InstallationRepair[],
): InstallationRecord[] {
  const docsByInstallation = new Map<string, InstallationDocument[]>();
  for (const doc of documents) {
    const list = docsByInstallation.get(doc.installation_id) ?? [];
    list.push(doc);
    docsByInstallation.set(doc.installation_id, list);
  }

  const repairsByInstallation = new Map<string, InstallationRepair[]>();
  for (const repair of repairs) {
    const list = repairsByInstallation.get(repair.installation_id) ?? [];
    list.push(repair);
    repairsByInstallation.set(repair.installation_id, list);
  }

  return installations.map((installation) => ({
    ...installation,
    documents: sortByOrder(docsByInstallation.get(installation.id) ?? []),
    repairs: [...(repairsByInstallation.get(installation.id) ?? [])].sort((a, b) =>
      b.occurred_on.localeCompare(a.occurred_on),
    ),
  }));
}

function mergeLocalCreates(records: InstallationRecord[]): InstallationRecord[] {
  const merged = applyLocalInstallationPatches(records);
  const seen = new Set(merged.map((record) => record.id));
  for (const created of loadLocalCreatedInstallations()) {
    if (!seen.has(created.id)) {
      merged.push({
        ...created,
        documents: [...created.documents],
        repairs: [...created.repairs],
      });
    }
  }
  return merged;
}

function listFromSeed(): InstallationRecord[] {
  const records = INSTALLATION_SEED_RECORDS.map((record) => ({
    ...record,
    documents: [...record.documents],
    repairs: [...record.repairs],
  })).sort((a, b) => a.sort_order - b.sort_order);

  return mergeLocalCreates(records);
}

export async function listInstallations(): Promise<InstallationRecord[]> {
  if (!isSupabaseConfigured()) {
    return listFromSeed();
  }

  const supabase = await db();
  const { data: installationRows, error: installationError } = await supabase
    .from('installations')
    .select('*')
    .order('sort_order', { ascending: true });

  if (
    installationError ||
    !installationRows?.length ||
    installationRows.length < INSTALLATION_SEED_RECORDS.length ||
    installationRows.some((row) => row.location == null)
  ) {
    return listFromSeed();
  }

  const ids = installationRows.map((row) => String(row.id));
  const [{ data: documentRows }, { data: repairRows }] = await Promise.all([
    supabase.from('installation_documents').select('*').in('installation_id', ids),
    supabase.from('installation_repairs').select('*').in('installation_id', ids),
  ]);

  const installations = installationRows.map((row) =>
    normalizeInstallation(row as Record<string, unknown>),
  );
  const documents = (documentRows ?? []).map((row) =>
    normalizeDocument(row as Record<string, unknown>),
  );
  const repairs = (repairRows ?? []).map((row) => normalizeRepair(row as Record<string, unknown>));

  return applyLocalInstallationPatches(
    attachRelations(installations, documents, repairs),
  );
}

export async function getInstallationById(id: string): Promise<InstallationRecord | null> {
  const installations = await listInstallations();
  return installations.find((installation) => installation.id === id) ?? null;
}

export type InstallationUpdatePatch = Partial<
  Pick<
    InstallationRecord,
    | 'name'
    | 'location'
    | 'lifecycle_status'
    | 'operational_status'
    | 'responsible_person'
    | 'last_inspection_date'
    | 'next_maintenance_date'
    | 'revizni_zprava_available'
    | 'remote_url'
  >
>;

export async function updateInstallationFields(
  id: string,
  patch: InstallationUpdatePatch,
): Promise<InstallationRecord> {
  const cleaned: InstallationUpdatePatch = { ...patch };
  if (cleaned.name !== undefined) {
    cleaned.name = cleaned.name.trim();
    if (!cleaned.name) throw new Error('Project name is required');
  }
  if (cleaned.responsible_person === '') cleaned.responsible_person = null;
  if (cleaned.remote_url === '') cleaned.remote_url = null;
  if (cleaned.last_inspection_date === '') cleaned.last_inspection_date = null;
  if (cleaned.next_maintenance_date === '') cleaned.next_maintenance_date = null;

  if (isSupabaseConfigured()) {
    const supabase = await db();
    const { error } = await supabase.from('installations').update(cleaned).eq('id', id);

    if (!error) {
      const updated = await getInstallationById(id);
      if (updated) {
        notifyInstallationsUpdated();
        return updated;
      }
    }
  }

  mergeLocalInstallationPatch(id, cleaned);
  const updated = await getInstallationById(id);
  if (!updated) {
    throw new Error('Installation not found');
  }

  notifyInstallationsUpdated();
  return updated;
}

export async function updateInstallationLifecycleStatus(
  id: string,
  lifecycle_status: InstallationLifecycleStatus,
): Promise<InstallationRecord> {
  return updateInstallationFields(id, { lifecycle_status });
}

export type CreateRepairInput = {
  occurred_on: string;
  summary: string;
  resolved?: boolean;
  notes?: string;
};

export async function createInstallationRepair(
  installationId: string,
  input: CreateRepairInput,
): Promise<InstallationRepair> {
  const summary = input.summary.trim();
  if (!summary) throw new Error('Summary is required');
  if (!input.occurred_on) throw new Error('Date is required');

  const repair: InstallationRepair = {
    id: `repair-${installationId}-${Date.now()}`,
    installation_id: installationId,
    occurred_on: input.occurred_on,
    summary,
    resolved: Boolean(input.resolved),
    notes: input.notes?.trim() ?? '',
    kind: 'repair',
    reported_by: null,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await db();
    const { data, error } = await supabase
      .from('installation_repairs')
      .insert({
        installation_id: installationId,
        occurred_on: repair.occurred_on,
        summary: repair.summary,
        resolved: repair.resolved,
        notes: repair.notes,
        kind: 'repair',
      })
      .select('*')
      .single();

    if (!error && data) {
      notifyInstallationsUpdated();
      return normalizeRepair(data as Record<string, unknown>);
    }
  }

  throw new Error('Could not save repair. Connect Supabase or try again.');
}

export async function updateInstallationRepair(
  repairId: string,
  input: Partial<CreateRepairInput>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.summary !== undefined) {
    const summary = input.summary.trim();
    if (!summary) throw new Error('Summary is required');
    patch.summary = summary;
  }
  if (input.occurred_on !== undefined) patch.occurred_on = input.occurred_on;
  if (input.resolved !== undefined) patch.resolved = input.resolved;
  if (input.notes !== undefined) patch.notes = input.notes.trim();

  if (isSupabaseConfigured()) {
    const supabase = await db();
    const { error } = await supabase.from('installation_repairs').update(patch).eq('id', repairId);
    if (!error) {
      notifyInstallationsUpdated();
      return;
    }
  }

  throw new Error('Could not update repair.');
}

export async function deleteInstallationRepair(repairId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await db();
    const { error } = await supabase.from('installation_repairs').delete().eq('id', repairId);
    if (!error) {
      notifyInstallationsUpdated();
      return;
    }
  }

  throw new Error('Could not delete repair.');
}

export type CreateBugReportInput = {
  title: string;
  description: string;
  reportedBy: string;
  occurredOn: string;
};

export async function createInstallationBugReport(
  installationId: string,
  input: CreateBugReportInput,
): Promise<InstallationRepair> {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) throw new Error('Title is required');
  if (!description) throw new Error('Description is required');
  if (!input.reportedBy) throw new Error('You must be logged in to report a bug.');
  if (!input.occurredOn) throw new Error('Date is required');

  if (!isSupabaseConfigured()) {
    throw new Error('Bug reports require Supabase to be connected.');
  }

  const supabase = await db();
  const { data, error } = await supabase
    .from('installation_repairs')
    .insert({
      installation_id: installationId,
      occurred_on: input.occurredOn,
      summary: title,
      notes: description,
      resolved: false,
      kind: 'bug_report',
      reported_by: input.reportedBy,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Could not submit bug report.');
  }

  notifyInstallationsUpdated();
  return normalizeRepair(data as Record<string, unknown>);
}

export async function createInstallation(
  input: CreateInstallationInput,
): Promise<InstallationRecord> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Project name is required');
  }

  const installations = await listInstallations();
  const existingIds = installations.map((installation) => installation.id);
  const id = ensureUniqueSlug(slugifyProjectName(name), existingIds);
  const inLocation = installations.filter((installation) => installation.location === input.location);
  const sort_order = inLocation.reduce((max, installation) => Math.max(max, installation.sort_order), 0) + 1;
  const now = new Date().toISOString();

  const record: InstallationRecord = {
    id,
    name,
    location: input.location,
    lifecycle_status: 'concept',
    operational_status: 'active',
    responsible_person: input.responsible_person?.trim() || null,
    last_inspection_date: null,
    next_maintenance_date: null,
    revizni_zprava_available: false,
    remote_url: null,
    sort_order,
    created_at: now,
    updated_at: now,
    documents: [],
    repairs: [],
  };

  if (isSupabaseConfigured()) {
    const supabase = await db();
    const { error } = await supabase.from('installations').insert({
      id: record.id,
      name: record.name,
      location: record.location,
      lifecycle_status: record.lifecycle_status,
      operational_status: record.operational_status,
      responsible_person: record.responsible_person,
      last_inspection_date: record.last_inspection_date,
      next_maintenance_date: record.next_maintenance_date,
      revizni_zprava_available: record.revizni_zprava_available,
      remote_url: record.remote_url,
      sort_order: record.sort_order,
    });

    if (!error) {
      notifyInstallationsUpdated();
      return record;
    }
  }

  appendLocalCreatedInstallation(record);
  notifyInstallationsUpdated();
  return record;
}
