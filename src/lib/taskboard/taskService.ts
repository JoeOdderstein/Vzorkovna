import type { Project, Task, TaskGroup, TaskInsert, TaskUpdate } from './types';
import type { TaskCategory } from './constants';
import { isSupabaseConfigured } from './config';
import { localStore } from './localStore';
import {
  LOCAL_PROJECT_SLUGS,
  clearLocalTasks,
  readLocalTasks,
} from './localTasksStorage';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { normalizeAssignees, normalizeTask } from './assigneeUtils';
import { ensureUniqueSlug, slugifyProjectName } from './projectUtils';
import {
  canUserSeeProject,
  filterProjectsForUser,
  normalizeProjectVisibleTo,
} from './projectVisibility';
import { seedDefaultCategoriesForProject } from './categoryService';

export function isLocalTaskboardMode() {
  return !isSupabaseConfigured();
}

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapTasks(rows: Record<string, unknown>[]): Task[] {
  return rows.map(normalizeTask);
}

function normalizeProject(row: Record<string, unknown>): Project {
  return {
    ...(row as Project),
    visible_to: normalizeProjectVisibleTo(row.visible_to),
  };
}

function mapProjects(rows: Record<string, unknown>[]): Project[] {
  return rows.map(normalizeProject);
}

async function fetchAllProjectsRaw(): Promise<Project[]> {
  if (isLocalTaskboardMode()) {
    return localStore.getProjects().map((project) => normalizeProject(project));
  }

  const { data, error } = await (await db())
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return mapProjects((data ?? []) as Record<string, unknown>[]);
}

/** All projects (admin manage dialog). */
export async function fetchProjects() {
  return fetchAllProjectsRaw();
}

/** False when Supabase is missing the visible_to column (migration not applied). */
export async function isProjectVisibilityReady() {
  if (isLocalTaskboardMode()) return true;

  const { error } = await (await db()).from('projects').select('visible_to').limit(1);
  return !error;
}

/** Projects visible to the current user. */
export async function fetchVisibleProjects(username: string | null, isAdmin = false) {
  const projects = await fetchAllProjectsRaw();
  return filterProjectsForUser(projects, username, isAdmin);
}

export async function fetchTaskboardUsernames() {
  const res = await fetch('/api/auth/usernames', { credentials: 'include' });
  if (!res.ok) throw new Error('Could not load taskboard users.');
  return res.json() as Promise<{ usernames: string[]; adminUsername: string }>;
}

export async function createProject(
  name: string,
  visible_to: string[] | null = null
): Promise<Project> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Project name is required');

  if (isLocalTaskboardMode()) return localStore.createProject(trimmed, visible_to);

  const supabase = await db();
  const { data: existing, error: fetchError } = await supabase.from('projects').select('slug');
  if (fetchError) throw fetchError;

  const slug = ensureUniqueSlug(
    slugifyProjectName(trimmed),
    (existing ?? []).map((p) => p.slug)
  );

  const { data: lastProject } = await supabase
    .from('projects')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (lastProject?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('projects')
    .insert({ name: trimmed, slug, sort_order, visible_to })
    .select('*')
    .single();

  if (error) {
    if (visible_to != null && /visible_to|column/i.test(error.message)) {
      throw new Error(
        'Could not save project visibility. Run supabase/migrations/005_project_visibility.sql in Supabase SQL Editor, then try again.'
      );
    }
    throw error;
  }

  const project = normalizeProject(data as Record<string, unknown>);
  try {
    await seedDefaultCategoriesForProject(project.id);
  } catch {
    // Project was created; categories can be seeded on first open.
  }
  return project;
}

export async function updateProject(
  id: string,
  updates: { name?: string; visible_to?: string[] | null }
): Promise<Project> {
  if (isLocalTaskboardMode()) return localStore.updateProject(id, updates);

  const supabase = await db();
  const patch: { name?: string; slug?: string; visible_to?: string[] | null } = {};

  if (updates.visible_to !== undefined) {
    patch.visible_to = updates.visible_to;
  }

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error('Project name is required');

    const { data: existing, error: fetchError } = await supabase
      .from('projects')
      .select('slug, id')
      .neq('id', id);
    if (fetchError) throw fetchError;

    patch.name = trimmed;
    patch.slug = ensureUniqueSlug(
      slugifyProjectName(trimmed),
      (existing ?? []).map((p) => p.slug)
    );
  }

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (updates.visible_to !== undefined && /visible_to|column/i.test(error.message)) {
      throw new Error(
        'Could not save project visibility. Run supabase/migrations/005_project_visibility.sql in Supabase SQL Editor, then try again.'
      );
    }
    throw error;
  }
  return normalizeProject(data as Record<string, unknown>);
}

export async function deleteProject(id: string): Promise<void> {
  if (isLocalTaskboardMode()) {
    localStore.deleteProject(id);
    return;
  }

  const { error } = await (await db()).from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchActiveTaskCountsByProject() {
  if (isLocalTaskboardMode()) return localStore.getActiveTaskCountsByProject();

  const { data, error } = await (await db())
    .from('tasks')
    .select('project_id')
    .eq('completed', false);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
  }
  return counts;
}

export async function fetchProjectBySlug(
  slug: string,
  username: string | null = null,
  isAdmin = false
) {
  if (isLocalTaskboardMode()) {
    const project = localStore.getProjectBySlug(slug);
    if (!project) throw new Error('Project not found');
    const normalized = normalizeProject(project);
    if (!canUserSeeProject(normalized, username, isAdmin)) throw new Error('Project not found');
    return normalized;
  }

  const { data, error } = await (await db())
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  const project = normalizeProject(data as Record<string, unknown>);
  if (!canUserSeeProject(project, username, isAdmin)) throw new Error('Project not found');
  return project;
}

export function filterTasksForProjects(tasks: Task[], projects: Project[]): Task[] {
  const ids = new Set(projects.map((project) => project.id));
  return tasks.filter((task) => ids.has(task.project_id));
}

export async function fetchActiveTasks(projectId: string) {
  if (isLocalTaskboardMode()) return localStore.getActiveTasks(projectId);

  const { data, error } = await (await db())
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('completed', false)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return mapTasks(data ?? []);
}

export async function fetchAllActiveTasks() {
  if (isLocalTaskboardMode()) return localStore.getAllActiveTasks();

  const { data, error } = await (await db())
    .from('tasks')
    .select('*')
    .eq('completed', false)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return mapTasks(data ?? []);
}

export async function fetchArchivedTasks(search = '') {
  if (isLocalTaskboardMode()) return localStore.getArchivedTasks(search);

  let query = (await db())
    .from('tasks')
    .select('*, project:projects(id, name, slug)')
    .eq('completed', true)
    .order('completed_at', { ascending: false });

  if (search.trim()) {
    query = query.ilike('task_name', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapTasks(data ?? []);
}

export function groupTasksByCategory(tasks: Task[], category: TaskCategory): TaskGroup[] {
  const parents = tasks
    .filter((t) => t.category === category && !t.parent_task_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return parents.map((parent) => ({
    parent,
    subtasks: tasks
      .filter((t) => t.parent_task_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function createTask(input: TaskInsert) {
  if (isLocalTaskboardMode()) return localStore.createTask(input);

  const supabase = await db();

  let assignees = input.assignees;
  let priority = input.priority;
  let deadline = input.deadline;

  if (
    input.parent_task_id &&
    (assignees === undefined || priority === undefined || deadline === undefined)
  ) {
    const { data: parent } = await supabase
      .from('tasks')
      .select('assignees, priority, deadline')
      .eq('id', input.parent_task_id)
      .single();

    if (parent) {
      if (assignees === undefined) assignees = normalizeAssignees(parent.assignees);
      if (priority === undefined) priority = parent.priority ?? 'normal';
      if (deadline === undefined) deadline = parent.deadline ?? null;
    }
  }

  const { data: existing } = await supabase
    .from('tasks')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .eq('category', input.category)
    .eq('completed', false)
    .is('parent_task_id', input.parent_task_id ?? null)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sort_order = existing?.[0]?.sort_order != null ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: input.project_id,
      category: input.category,
      parent_task_id: input.parent_task_id ?? null,
      task_name: input.task_name ?? 'New task',
      description: input.description ?? '',
      assignees: assignees ?? [],
      priority: priority ?? 'normal',
      deadline: deadline ?? null,
      sort_order,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeTask(data);
}

export async function updateTask(id: string, updates: TaskUpdate) {
  if (isLocalTaskboardMode()) return localStore.updateTask(id, updates);

  const payload: TaskUpdate = { ...updates };
  if (updates.completed === true) {
    payload.completed_at = new Date().toISOString();
  }
  if (updates.completed === false) {
    payload.completed_at = null;
  }

  const { data, error } = await (await db())
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeTask(data);
}

export async function deleteTask(id: string) {
  if (isLocalTaskboardMode()) return;

  const { error } = await (await db()).from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderTasks(
  updates: { id: string; category: TaskCategory; sort_order: number; parent_task_id?: string | null }[]
) {
  if (isLocalTaskboardMode()) {
    localStore.reorderTasks(updates);
    return;
  }

  const supabase = await db();
  const results = await Promise.all(
    updates.map(({ id, category, sort_order, parent_task_id }) => {
      const payload: TaskUpdate = { category, sort_order };
      if (parent_task_id !== undefined) payload.parent_task_id = parent_task_id;
      return supabase.from('tasks').update(payload).eq('id', id);
    })
  );

  const error = results.find((r) => r.error)?.error;
  if (error) throw error;
}

export async function nestTaskUnderParent(taskId: string, targetParentId: string) {
  if (isLocalTaskboardMode()) return localStore.nestTask(taskId, targetParentId);

  const supabase = await db();
  const { data: dragged, error: draggedError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  if (draggedError || !dragged) throw draggedError ?? new Error('Task not found');

  const { data: projectTasks, error: listError } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', dragged.project_id)
    .eq('completed', false);
  if (listError || !projectTasks) throw listError ?? new Error('Could not load tasks');

  const tasks = mapTasks(projectTasks as Record<string, unknown>[]);
  const target = tasks.find((t) => t.id === targetParentId);
  if (!target) throw new Error('Target task not found');
  if (taskId === targetParentId) return dragged as Task;
  if (target.parent_task_id) throw new Error('Can only nest under top-level tasks');

  const wasTopLevel = !dragged.parent_task_id;
  const oldCategory = dragged.category as TaskCategory;
  const updates: { id: string; category: TaskCategory; sort_order: number; parent_task_id?: string | null }[] = [];

  const childSubtasks = tasks.filter((t) => t.parent_task_id === taskId);
  const topLevelInTargetCategory = tasks.filter(
    (t) =>
      t.category === target.category &&
      !t.parent_task_id &&
      t.id !== taskId
  );
  let topOrder = topLevelInTargetCategory.length;

  for (const sub of childSubtasks) {
    updates.push({
      id: sub.id,
      category: target.category as TaskCategory,
      sort_order: topOrder++,
      parent_task_id: null,
    });
  }

  const siblingSubtasks = tasks.filter(
    (t) => t.parent_task_id === targetParentId && t.id !== taskId
  );
  const subSort =
    siblingSubtasks.length > 0
      ? Math.max(...siblingSubtasks.map((s) => s.sort_order)) + 1
      : 0;

  updates.push({
    id: taskId,
    category: target.category as TaskCategory,
    sort_order: subSort,
    parent_task_id: targetParentId,
  });

  if (wasTopLevel) {
    const remaining = tasks
      .filter((t) => t.category === oldCategory && !t.parent_task_id && t.id !== taskId)
      .sort((a, b) => a.sort_order - b.sort_order);
    remaining.forEach((t, i) => {
      updates.push({ id: t.id, category: oldCategory, sort_order: i });
    });
  }

  await reorderTasks(updates);
  return dragged as Task;
}

export async function promoteTaskToParent(taskId: string, category: TaskCategory) {
  if (isLocalTaskboardMode()) {
    return localStore.promoteTask(taskId, category, 9999);
  }

  const supabase = await db();
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  if (error || !task) throw error ?? new Error('Task not found');

  const { data: siblings } = await supabase
    .from('tasks')
    .select('sort_order')
    .eq('project_id', task.project_id)
    .eq('category', category)
    .eq('completed', false)
    .is('parent_task_id', null);

  const order = siblings?.length ?? 0;

  await updateTask(taskId, {
    parent_task_id: null,
    category,
    sort_order: order,
  });

  const { data: parents } = await supabase
    .from('tasks')
    .select('id, sort_order')
    .eq('project_id', task.project_id)
    .eq('category', category)
    .eq('completed', false)
    .is('parent_task_id', null)
    .order('sort_order', { ascending: true });

  if (parents) {
    await reorderTasks(
      parents.map((p, i) => ({
        id: p.id,
        category,
        sort_order: i,
      }))
    );
  }

  return task as Task;
}

export async function uploadAttachment(file: File, taskId: string) {
  if (isLocalTaskboardMode()) {
    throw new Error('File uploads require Supabase. Use a Google Drive link for now.');
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${taskId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await (await db())
    .storage
    .from('task-attachments')
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  return { path, name: file.name };
}

export async function getAttachmentUrl(path: string) {
  if (isLocalTaskboardMode()) throw new Error('Attachments require Supabase.');

  const { data, error } = await (await db())
    .storage
    .from('task-attachments')
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}

export function subscribeToProjectTasks(projectId: string, onChange: () => void) {
  if (isLocalTaskboardMode()) return localStore.subscribe(projectId, onChange);

  let cancelled = false;
  let cleanup: (() => void) | undefined;

  ensureSupabaseSession().then(() => {
    if (cancelled) return;
    const channel = getSupabase()
      .channel(`tasks:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        () => onChange()
      )
      .subscribe();

    cleanup = () => {
      getSupabase().removeChannel(channel);
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export function subscribeToArchive(onChange: () => void) {
  if (isLocalTaskboardMode()) return () => {};

  let cancelled = false;
  let cleanup: (() => void) | undefined;

  ensureSupabaseSession().then(() => {
    if (cancelled) return;
    const channel = getSupabase()
      .channel('tasks:archive')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => onChange()
      )
      .subscribe();

    cleanup = () => {
      getSupabase().removeChannel(channel);
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export async function importLocalTasksToSupabase() {
  if (isLocalTaskboardMode()) {
    throw new Error('Supabase is not configured.');
  }

  const localTasks = readLocalTasks();
  if (localTasks.length === 0) {
    return { imported: 0 };
  }

  const projects = await fetchProjects();
  const slugToId = Object.fromEntries(projects.map((p) => [p.slug, p.id]));

  const resolveProjectId = (localProjectId: string) => {
    const slug = LOCAL_PROJECT_SLUGS[localProjectId];
    return slug ? slugToId[slug] : null;
  };

  const parents = localTasks.filter((t) => !t.parent_task_id);
  const children = localTasks.filter((t) => t.parent_task_id);
  const ordered = [...parents, ...children];

  const supabase = await db();
  let imported = 0;

  for (const task of ordered) {
    const project_id = resolveProjectId(task.project_id);
    if (!project_id) continue;

    const row = {
      id: task.id,
      project_id,
      parent_task_id: task.parent_task_id,
      category: task.category,
      task_name: task.task_name || 'Untitled task',
      description: task.description ?? '',
      assignees: normalizeAssignees(task.assignees ?? (task as { assigned_to?: unknown }).assigned_to),
      priority: task.priority,
      deadline: task.deadline,
      completed: task.completed,
      completed_at: task.completed_at,
      google_drive_url: task.google_drive_url,
      attachment_path: task.attachment_path,
      attachment_name: task.attachment_name,
      sort_order: task.sort_order,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
    };

    const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
    if (error) throw error;
    imported++;
  }

  clearLocalTasks();
  return { imported };
}
