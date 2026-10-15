import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from './config';
import { isActiveProjectTimeline, type TimelineBlockInput } from './projectTimelineUtils';
import { isLocalTaskboardMode } from './taskService';

export type ProjectTimelineEntry = {
  id: string;
  project_id: string;
  week_start: string;
  week_end: string;
  name: string;
  description: string;
};

export type ProjectTimelineState = {
  timelineCompleted: boolean;
  entries: ProjectTimelineEntry[];
};

const LOCAL_KEY = 'project_timeline_v2';

type LocalStore = Record<
  string,
  { timelineCompleted: boolean; entries: ProjectTimelineEntry[] }
>;

function loadLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
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
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    week_start,
    week_end: week_endRaw,
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
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
    const entries: ProjectTimelineEntry[] = blocks.map((block) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      week_start: block.week_start,
      week_end: block.week_end,
      name: block.name.trim(),
      description: block.description.trim(),
    }));
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

  const toInsert = blocks.map((block) => ({
    project_id: projectId,
    week_start: block.week_start,
    week_end: block.week_end,
    name: block.name.trim(),
    description: block.description.trim(),
  }));

  if (toInsert.length > 0) {
    let { error: insertError } = await supabase.from('project_timeline_entries').insert(toInsert);

    if (insertError && /week_end|column|schema cache/i.test(insertError.message)) {
      ({ error: insertError } = await supabase.from('project_timeline_entries').insert(
        toInsert.map((row) => ({
          project_id: row.project_id,
          week_start: row.week_start,
          name: row.name,
          description: row.description,
        }))
      ));
    }

    if (insertError) {
      if (/week_end|column|schema cache/i.test(insertError.message)) {
        throw new Error(
          'Multi-week timeline needs supabase/migrations/039_project_timeline_week_ranges.sql in Supabase.'
        );
      }
      throw insertError;
    }
  }

  return fetchProjectTimeline(projectId);
}
