import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from './config';
import { isLocalTaskboardMode } from './taskService';

export type ProjectTimelineEntry = {
  id: string;
  project_id: string;
  week_start: string;
  name: string;
  description: string;
};

export type ProjectTimelineState = {
  timelineCompleted: boolean;
  entries: ProjectTimelineEntry[];
};

const LOCAL_KEY = 'project_timeline_v1';

type LocalStore = Record<
  string,
  { timelineCompleted: boolean; entries: ProjectTimelineEntry[] }
>;

function loadLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalStore) : {};
  } catch {
    return {};
  }
}

function saveLocal(store: LocalStore) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function mapEntry(row: Record<string, unknown>): ProjectTimelineEntry {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    week_start: String(row.week_start).slice(0, 10),
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

export type ProjectTimelineRowInput = {
  week_start: string;
  name: string;
  description: string;
};

export async function saveProjectTimeline(
  projectId: string,
  rows: ProjectTimelineRowInput[],
  timelineCompleted: boolean
): Promise<ProjectTimelineState> {
  if (!projectId) throw new Error('Project is required.');

  if (isLocalTaskboardMode()) {
    const store = loadLocal();
    const entries: ProjectTimelineEntry[] = rows
      .filter((row) => row.name.trim() || row.description.trim())
      .map((row) => ({
        id: crypto.randomUUID(),
        project_id: projectId,
        week_start: row.week_start,
        name: row.name.trim(),
        description: row.description.trim(),
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

  const toInsert = rows
    .map((row) => ({
      project_id: projectId,
      week_start: row.week_start,
      name: row.name.trim(),
      description: row.description.trim(),
    }))
    .filter((row) => row.name || row.description);

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('project_timeline_entries').insert(toInsert);
    if (insertError) throw insertError;
  }

  return fetchProjectTimeline(projectId);
}
