import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from './config';
import {
  isActiveProjectTimeline,
  isTimelinePhase,
  isTimelineVisit,
  normalizeTimelineRichField,
  type TimelineBlockInput,
  type TimelineEntryKind,
} from './projectTimelineUtils';
import { isLocalTaskboardMode } from './taskService';

export type ProjectTimelineEntry = {
  id: string;
  project_id: string;
  week_start: string;
  week_end: string;
  name: string;
  description: string;
  entry_kind: TimelineEntryKind;
  parent_entry_id: string | null;
};

export type ProjectTimelineState = {
  timelineCompleted: boolean;
  entries: ProjectTimelineEntry[];
};

const LOCAL_KEY = 'project_timeline_v3';

type LocalStore = Record<
  string,
  { timelineCompleted: boolean; entries: ProjectTimelineEntry[] }
>;

function loadLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
    const v2Raw = localStorage.getItem('project_timeline_v2');
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw) as LocalStore;
      const migrated: LocalStore = {};
      for (const [projectId, bucket] of Object.entries(v2)) {
        migrated[projectId] = {
          timelineCompleted: bucket.timelineCompleted,
          entries: bucket.entries.map((e) => ({
            ...e,
            entry_kind: e.entry_kind ?? 'phase',
            parent_entry_id: e.parent_entry_id ?? null,
          })),
        };
      }
      return migrated;
    }
    const legacyRaw = localStorage.getItem('project_timeline_v1');
    if (!legacyRaw) return {};
    const legacy = JSON.parse(legacyRaw) as Record<
      string,
      { timelineCompleted: boolean; entries: Omit<ProjectTimelineEntry, 'week_end'>[] }
    >;
    const migrated: LocalStore = {};
    for (const [projectId, bucket] of Object.entries(legacy)) {
      migrated[projectId] = {
        timelineCompleted: bucket.timelineCompleted,
        entries: bucket.entries.map((e) => ({
          ...e,
          week_end: e.week_start,
          entry_kind: 'phase' as const,
          parent_entry_id: null,
        })),
      };
    }
    return migrated;
  } catch {
    return {};
  }
}

function saveLocal(store: LocalStore) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function mapEntry(row: Record<string, unknown>): ProjectTimelineEntry {
  const week_start = String(row.week_start).slice(0, 10);
  const week_endRaw = row.week_end ? String(row.week_end).slice(0, 10) : week_start;
  const kindRaw = String(row.entry_kind ?? 'phase');
  const entry_kind: TimelineEntryKind = kindRaw === 'visit' ? 'visit' : 'phase';
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    week_start,
    week_end: week_endRaw,
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    entry_kind,
    parent_entry_id: row.parent_entry_id ? String(row.parent_entry_id) : null,
  };
}

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

export async function fetchProjectTimeline(projectId: string): Promise<ProjectTimelineState> {
  if (!projectId) {
    return { timelineCompleted: false, entries: [] };
  }

  if (isLocalTaskboardMode()) {
    const bucket = loadLocal()[projectId];
    return bucket ?? { timelineCompleted: false, entries: [] };
  }

  if (!isSupabaseConfigured()) {
    return { timelineCompleted: false, entries: [] };
  }

  const supabase = await db();

  let timelineCompleted = false;
  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .select('timeline_completed')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError && !/timeline_completed|column|schema cache/i.test(projectError.message)) {
    throw projectError;
  }
  if (projectRow && typeof projectRow.timeline_completed === 'boolean') {
    timelineCompleted = projectRow.timeline_completed;
  }

  const { data, error } = await supabase
    .from('project_timeline_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('week_start', { ascending: true });

  if (error) {
    if (/project_timeline_entries|timeline_completed|relation|schema cache/i.test(error.message)) {
      return { timelineCompleted: false, entries: [] };
    }
    throw error;
  }

  return {
    timelineCompleted,
    entries: (data ?? []).map((row) => mapEntry(row as Record<string, unknown>)),
  };
}

/** Which projects have an ongoing timeline (for project filter ordering). */
export async function fetchActiveTimelineProjectIds(
  projectIds: string[]
): Promise<Set<string>> {
  const active = new Set<string>();
  if (projectIds.length === 0) return active;

  if (isLocalTaskboardMode()) {
    const store = loadLocal();
    for (const projectId of projectIds) {
      const bucket = store[projectId];
      if (bucket && isActiveProjectTimeline(bucket)) active.add(projectId);
    }
    return active;
  }

  if (!isSupabaseConfigured()) return active;

  const supabase = await db();
  const ids = [...new Set(projectIds)];

  const completedByProject = new Map<string, boolean>();
  for (const id of ids) completedByProject.set(id, false);

  const { data: projectRows, error: projectError } = await supabase
    .from('projects')
    .select('id, timeline_completed')
    .in('id', ids);

  if (projectError && !/timeline_completed|column|schema cache/i.test(projectError.message)) {
    throw projectError;
  }
  for (const row of projectRows ?? []) {
    const id = String(row.id);
    completedByProject.set(id, Boolean(row.timeline_completed));
  }

  const { data: entryRows, error: entryError } = await supabase
    .from('project_timeline_entries')
    .select('project_id, name, description')
    .in('project_id', ids);

  if (entryError) {
    if (/project_timeline_entries|relation|schema cache/i.test(entryError.message)) {
      return active;
    }
    throw entryError;
  }

  const entriesByProject = new Map<string, { name: string; description: string }[]>();
  for (const id of ids) entriesByProject.set(id, []);
  for (const row of entryRows ?? []) {
    const projectId = String(row.project_id);
    const list = entriesByProject.get(projectId);
    if (!list) continue;
    list.push({
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
    });
  }

  for (const projectId of ids) {
    if (
      isActiveProjectTimeline({
        timelineCompleted: completedByProject.get(projectId) ?? false,
        entries: entriesByProject.get(projectId) ?? [],
      })
    ) {
      active.add(projectId);
    }
  }

  return active;
}

export type ProjectTimelineBlockInput = TimelineBlockInput;

export async function saveProjectTimeline(
  projectId: string,
  blocks: ProjectTimelineBlockInput[],
  timelineCompleted: boolean
): Promise<ProjectTimelineState> {
  if (!projectId) throw new Error('Project is required.');

  if (isLocalTaskboardMode()) {
    const store = loadLocal();
    const phaseBlocks = blocks.filter(isTimelinePhase);
    const visitBlocks = blocks.filter(isTimelineVisit);
    const entries: ProjectTimelineEntry[] = [];

    for (const block of phaseBlocks) {
      entries.push({
        id: block.client_key,
        project_id: projectId,
        week_start: block.week_start,
        week_end: block.week_end,
        name: normalizeTimelineRichField(block.name),
        description: normalizeTimelineRichField(block.description),
        entry_kind: 'phase',
        parent_entry_id: null,
      });
    }

    const phaseIds = new Set(entries.map((e) => e.id));
    for (const block of visitBlocks) {
      const parentId = block.parent_client_key ?? block.parent_entry_id ?? null;
      entries.push({
        id: block.client_key,
        project_id: projectId,
        week_start: block.week_start,
        week_end: block.week_end,
        name: normalizeTimelineRichField(block.name),
        description: normalizeTimelineRichField(block.description),
        entry_kind: 'visit',
        parent_entry_id: parentId && phaseIds.has(parentId) ? parentId : null,
      });
    }

    store[projectId] = { timelineCompleted, entries };
    saveLocal(store);
    return store[projectId];
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Timeline requires Supabase.');
  }

  const supabase = await db();

  const { error: projectError } = await supabase
    .from('projects')
    .update({ timeline_completed: timelineCompleted })
    .eq('id', projectId);

  if (projectError) {
    if (/timeline_completed|column|schema cache/i.test(projectError.message)) {
      throw new Error(
        'Project timeline needs a database update. Run supabase/migrations/038_project_timeline.sql in Supabase.'
      );
    }
    throw projectError;
  }

  const { error: deleteError } = await supabase
    .from('project_timeline_entries')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) {
    if (/project_timeline_entries|relation|schema cache/i.test(deleteError.message)) {
      throw new Error(
        'Project timeline needs a database update. Run supabase/migrations/038_project_timeline.sql in Supabase.'
      );
    }
    throw deleteError;
  }

  const phaseBlocks = blocks.filter(isTimelinePhase);
  const visitBlocks = blocks.filter(isTimelineVisit);

  const phaseInserts = phaseBlocks.map((block) => ({
    id: block.client_key,
    project_id: projectId,
    week_start: block.week_start,
    week_end: block.week_end,
    name: normalizeTimelineRichField(block.name),
    description: normalizeTimelineRichField(block.description),
    entry_kind: 'phase' as const,
    parent_entry_id: null,
  }));

  if (phaseInserts.length > 0) {
    let { error: phaseError } = await supabase.from('project_timeline_entries').insert(phaseInserts);

    if (phaseError && /entry_kind|parent_entry|column|schema cache/i.test(phaseError.message)) {
      ({ error: phaseError } = await supabase.from('project_timeline_entries').insert(
        phaseInserts.map((row) => ({
          id: row.id,
          project_id: row.project_id,
          week_start: row.week_start,
          week_end: row.week_end,
          name: row.name,
          description: row.description,
        })),
      ));
    }

    if (phaseError) {
      if (/week_end|column|schema cache/i.test(phaseError.message)) {
        throw new Error(
          'Multi-week timeline needs supabase/migrations/039_project_timeline_week_ranges.sql in Supabase.'
        );
      }
      throw phaseError;
    }
  }

  const phaseIds = new Set(phaseInserts.map((row) => row.id));
  const visitInserts = visitBlocks.map((block) => {
    const parentId = block.parent_client_key ?? block.parent_entry_id ?? null;
    return {
      id: block.client_key,
      project_id: projectId,
      week_start: block.week_start,
      week_end: block.week_end,
      name: normalizeTimelineRichField(block.name),
      description: normalizeTimelineRichField(block.description),
      entry_kind: 'visit' as const,
      parent_entry_id: parentId && phaseIds.has(parentId) ? parentId : null,
    };
  });

  if (visitInserts.length > 0) {
    let { error: visitError } = await supabase.from('project_timeline_entries').insert(visitInserts);

    if (visitError && /entry_kind|parent_entry|column|schema cache/i.test(visitError.message)) {
      throw new Error(
        'Timeline visits need supabase/migrations/048_project_timeline_visits.sql in Supabase.'
      );
    }

    if (visitError) {
      throw visitError;
    }
  }

  return fetchProjectTimeline(projectId);
}

/** Load timeline state for many projects (calendar timetable view). */
export async function fetchProjectTimelinesBatch(
  projectIds: string[]
): Promise<Map<string, ProjectTimelineState>> {
  const result = new Map<string, ProjectTimelineState>();
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (ids.length === 0) return result;

  for (const id of ids) {
    result.set(id, { timelineCompleted: false, entries: [] });
  }

  if (isLocalTaskboardMode()) {
    const store = loadLocal();
    for (const id of ids) {
      result.set(id, store[id] ?? { timelineCompleted: false, entries: [] });
    }
    return result;
  }

  if (!isSupabaseConfigured()) return result;

  const supabase = await db();

  const { data: projectRows, error: projectError } = await supabase
    .from('projects')
    .select('id, timeline_completed')
    .in('id', ids);

  if (projectError && !/timeline_completed|column|schema cache/i.test(projectError.message)) {
    throw projectError;
  }

  for (const row of projectRows ?? []) {
    const id = String(row.id);
    result.set(id, {
      timelineCompleted: Boolean(row.timeline_completed),
      entries: result.get(id)?.entries ?? [],
    });
  }

  const { data: entryRows, error: entryError } = await supabase
    .from('project_timeline_entries')
    .select('*')
    .in('project_id', ids)
    .order('week_start', { ascending: true });

  if (entryError) {
    if (/project_timeline_entries|relation|schema cache/i.test(entryError.message)) {
      return result;
    }
    throw entryError;
  }

  for (const row of entryRows ?? []) {
    const entry = mapEntry(row as Record<string, unknown>);
    const bucket = result.get(entry.project_id);
    if (!bucket) continue;
    bucket.entries.push(entry);
  }

  return result;
}
