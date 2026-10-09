import {
  htmlMessageHasContent,
  messageBodyToPlainText,
  normalizeOutgoingMessageBody,
} from './messageRichText';
import type { TaskCategory } from '../taskboard/constants';
import type {
  CreateTeamMessageInput,
  TeamMessage,
  TeamMessageLinkedTask,
  TeamMessageProject,
  UpdateTeamMessageInput,
} from './types';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { createTask, isLocalTaskboardMode } from '../taskboard/taskService';
import { normalizeAssignees } from '../taskboard/assigneeUtils';
import { readLocalTasks } from '../taskboard/localTasksStorage';
import { localStore } from '../taskboard/localStore';
import { isSupabaseConfigured } from '../taskboard/config';

const LOCAL_STORAGE_KEY = 'team_messages_v1';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapLinkedTaskIds(row: Record<string, unknown>): string[] {
  const fromArray = row.linked_task_ids;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    return fromArray.map((id) => String(id));
  }
  if (row.linked_task_id) return [String(row.linked_task_id)];
  return [];
}

function mapRow(row: Record<string, unknown>): TeamMessage {
  const linked_task_ids = mapLinkedTaskIds(row);
  const categoryRaw = row.category;
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    project_id: row.project_id ? String(row.project_id) : null,
    category:
      typeof categoryRaw === 'string' && categoryRaw.trim()
        ? (categoryRaw as TaskCategory)
        : null,
    author_username: String(row.author_username ?? ''),
    author_display_name: String(row.author_display_name ?? ''),
    linked_task_id: linked_task_ids[0] ?? null,
    linked_task_ids,
    created_at: String(row.created_at ?? ''),
    project: null,
    linked_task: null,
    linked_tasks: [],
  };
}

function loadLocalMessages(): TeamMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as TeamMessage[]).slice().sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
  } catch {
    return [];
  }
}

function saveLocalMessages(messages: TeamMessage[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
}

function authorUsernamesMatch(stored: string, actor: string) {
  return stored.trim().toLowerCase() === actor.trim().toLowerCase();
}

function taskToLinkedSummary(
  taskId: string,
  tasks: ReturnType<typeof readLocalTasks>,
  projectById: Map<string, { name: string; slug: string }>
): TeamMessageLinkedTask | null {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const project = projectById.get(task.project_id);
  return {
    id: task.id,
    task_name: task.task_name,
    assignees: task.assignees,
    project: project ? { name: project.name, slug: project.slug } : null,
  };
}

function enrichLocalLinkedTasks(messages: TeamMessage[]): TeamMessage[] {
  const tasks = readLocalTasks();
  const projects = localStore.getProjects();
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return messages.map((message) => {
    const ids = message.linked_task_ids?.length
      ? message.linked_task_ids
      : message.linked_task_id
        ? [message.linked_task_id]
        : [];
    const linked_tasks = ids
      .map((id) => taskToLinkedSummary(id, tasks, projectById))
      .filter(Boolean) as TeamMessageLinkedTask[];
    return {
      ...message,
      linked_tasks,
      linked_task: linked_tasks[0] ?? null,
    };
  });
}

function enrichLocalMessageProjects(messages: TeamMessage[]): TeamMessage[] {
  const projects = localStore.getProjects();
  const byId = new Map(projects.map((p) => [p.id, p]));
  return messages.map((message) => {
    if (!message.project_id) return message;
    const project = byId.get(message.project_id);
    return {
      ...message,
      project: project
        ? { id: project.id, name: project.name, slug: project.slug }
        : null,
    };
  });
}

async function enrichMessageProjects(messages: TeamMessage[]): Promise<TeamMessage[]> {
  const ids = [...new Set(messages.map((m) => m.project_id).filter(Boolean))] as string[];
  if (ids.length === 0) return messages;

  const { data, error } = await (await db())
    .from('projects')
    .select('id, name, slug')
    .in('id', ids);

  if (error) {
    console.warn('Messages: could not enrich projects', error);
    return messages;
  }

  const byId = new Map<string, TeamMessageProject>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    byId.set(String(row.id), {
      id: String(row.id),
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
    });
  }

  return messages.map((message) => ({
    ...message,
    project: message.project_id ? byId.get(message.project_id) ?? null : null,
  }));
}

async function enrichLinkedTasks(messages: TeamMessage[]): Promise<TeamMessage[]> {
  const ids = [
    ...new Set(
      messages.flatMap((m) =>
        m.linked_task_ids?.length ? m.linked_task_ids : m.linked_task_id ? [m.linked_task_id] : []
      )
    ),
  ] as string[];
  if (ids.length === 0) return messages;

  const { data, error } = await (await db())
    .from('tasks')
    .select('id, task_name, assignees, project:projects(name, slug)')
    .in('id', ids);

  if (error) {
    console.warn('Messages: could not enrich linked tasks', error);
    return messages;
  }

  const byId = new Map<string, TeamMessageLinkedTask>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = String(row.id);
    const projectRaw = row.project as Record<string, unknown> | null | undefined;
    byId.set(id, {
      id,
      task_name: String(row.task_name ?? ''),
      assignees: normalizeAssignees(row.assignees),
      project: projectRaw
        ? {
            name: String(projectRaw.name ?? ''),
            slug: String(projectRaw.slug ?? ''),
          }
        : null,
    });
  }

  return messages.map((message) => {
    const messageIds = message.linked_task_ids?.length
      ? message.linked_task_ids
      : message.linked_task_id
        ? [message.linked_task_id]
        : [];
    const linked_tasks = messageIds
      .map((id) => byId.get(id))
      .filter(Boolean) as TeamMessageLinkedTask[];
    return {
      ...message,
      linked_tasks,
      linked_task: linked_tasks[0] ?? null,
    };
  });
}

export async function isTeamMessagesReady() {
  if (isLocalTaskboardMode()) return true;
  const { error } = await (await db()).from('team_messages').select('id').limit(1);
  return !error;
}

async function enrichMessages(messages: TeamMessage[]): Promise<TeamMessage[]> {
  const withProjects = isLocalTaskboardMode()
    ? enrichLocalMessageProjects(messages)
    : await enrichMessageProjects(messages);
  return enrichLinkedTasks(withProjects);
}

export const TEAM_MESSAGES_PAGE_SIZE = 20;

export type TeamMessagesPage = {
  messages: TeamMessage[];
  hasMoreOlder: boolean;
};

function compareMessagesChronological(a: TeamMessage, b: TeamMessage): number {
  const byTime = a.created_at.localeCompare(b.created_at);
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

function sortMessagesChronological(messages: TeamMessage[]): TeamMessage[] {
  return messages.slice().sort(compareMessagesChronological);
}

/** Merge by id (server rows win); keep chronological order for the feed. */
export function mergeTeamMessagesById(
  existing: TeamMessage[],
  updates: TeamMessage[]
): TeamMessage[] {
  const byId = new Map<string, TeamMessage>();
  for (const message of existing) {
    byId.set(message.id, message);
  }
  for (const message of updates) {
    byId.set(message.id, message);
  }
  return sortMessagesChronological(Array.from(byId.values()));
}

function isMessageBefore(message: TeamMessage, cursor: TeamMessage): boolean {
  return compareMessagesChronological(message, cursor) < 0;
}

function normalizeLocalMessages(): TeamMessage[] {
  return loadLocalMessages().map((m) => ({
    ...m,
    title: m.title ?? '',
    project_id: m.project_id ?? null,
    category: m.category ?? null,
  }));
}

function localMessagesPageRecent(all: TeamMessage[], limit: number): TeamMessagesPage {
  const sorted = sortMessagesChronological(all);
  const hasMoreOlder = sorted.length > limit;
  const messages = sorted.slice(-limit);
  return { messages, hasMoreOlder };
}

function localMessagesPageBefore(
  all: TeamMessage[],
  cursor: TeamMessage,
  limit: number
): TeamMessagesPage {
  const sorted = sortMessagesChronological(all);
  const older = sorted.filter((m) => isMessageBefore(m, cursor));
  const hasMoreOlder = older.length > limit;
  const messages = older.slice(-limit);
  return { messages, hasMoreOlder };
}

function olderThanCursorFilter(cursor: TeamMessage): string {
  const createdAt = cursor.created_at.replace(/"/g, '\\"');
  const id = cursor.id.replace(/"/g, '\\"');
  return `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`;
}

async function fetchSupabasePageRecent(limit: number): Promise<TeamMessagesPage> {
  const { data, error } = await (await db())
    .from('team_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (error) throw error;
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  const hasMoreOlder = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const messages = await enrichMessages(page);
  return { messages, hasMoreOlder };
}

async function fetchSupabasePageBefore(cursor: TeamMessage, limit: number): Promise<TeamMessagesPage> {
  const { data, error } = await (await db())
    .from('team_messages')
    .select('*')
    .or(olderThanCursorFilter(cursor))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (error) throw error;
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  const hasMoreOlder = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const messages = await enrichMessages(page);
  return { messages, hasMoreOlder };
}

/** Most recent messages (chronological, oldest → newest). */
export async function fetchTeamMessagesRecent(
  limit = TEAM_MESSAGES_PAGE_SIZE
): Promise<TeamMessagesPage> {
  if (isLocalTaskboardMode()) {
    const all = normalizeLocalMessages();
    const { messages, hasMoreOlder } = localMessagesPageRecent(all, limit);
    return { messages: await enrichMessages(messages), hasMoreOlder };
  }
  return fetchSupabasePageRecent(limit);
}

/** Messages older than `cursor` (same sort order as the feed). */
export async function fetchTeamMessagesOlderThan(
  cursor: TeamMessage,
  limit = TEAM_MESSAGES_PAGE_SIZE
): Promise<TeamMessagesPage> {
  if (isLocalTaskboardMode()) {
    const all = normalizeLocalMessages();
    const { messages, hasMoreOlder } = localMessagesPageBefore(all, cursor, limit);
    return { messages: await enrichMessages(messages), hasMoreOlder };
  }
  return fetchSupabasePageBefore(cursor, limit);
}

/** Reload up to `windowSize` newest messages (keeps pagination depth after edits). */
export async function fetchTeamMessagesWindow(windowSize: number): Promise<TeamMessagesPage> {
  const limit = Math.max(TEAM_MESSAGES_PAGE_SIZE, windowSize);
  return fetchTeamMessagesRecent(limit);
}

/** @deprecated Prefer fetchTeamMessagesRecent / fetchTeamMessagesWindow. */
export async function fetchTeamMessages(limit = 80): Promise<TeamMessage[]> {
  const { messages } = await fetchTeamMessagesWindow(limit);
  return messages;
}

export async function createTeamMessage(input: CreateTeamMessageInput): Promise<TeamMessage> {
  const title = input.title.trim();
  const body = normalizeOutgoingMessageBody(input.body);
  const bodyPlain = messageBodyToPlainText(body);
  if (!title) throw new Error('Message title is required.');
  if (!htmlMessageHasContent(body)) throw new Error('Message cannot be empty.');
  if (!input.projectId) throw new Error('Choose a project for this message.');
  if (!input.category) throw new Error('Choose a category for this message.');
  if (!input.author.username) throw new Error('You must be logged in to post.');

  const points =
    input.actionPoints && input.actionPoints.length > 0
      ? input.actionPoints
      : input.actionPoint
        ? [input.actionPoint]
        : [];

  const linkedTaskIds: string[] = [];

  for (const ap of points) {
    const taskName = ap.taskName.trim();
    if (!taskName) throw new Error('Action point needs a title.');
    if (!ap.projectId) throw new Error('Choose a project for the action point.');
    if (!ap.assignees?.length) throw new Error('Assign at least one person to each action point.');

    const task = await createTask({
      project_id: ap.projectId,
      category: ap.category,
      task_name: taskName,
        description: bodyPlain || 'Image in team message',
      assignees: ap.assignees ?? [],
    });
    linkedTaskIds.push(task.id);
  }

  const linkedTaskId = linkedTaskIds[0] ?? null;

  if (isLocalTaskboardMode()) {
    const message: TeamMessage = {
      id: crypto.randomUUID(),
      title,
      body,
      project_id: input.projectId,
      category: input.category,
      author_username: input.author.username,
      author_display_name: input.author.displayName,
      linked_task_id: linkedTaskId,
      linked_task_ids: linkedTaskIds,
      created_at: new Date().toISOString(),
    };
    const all = loadLocalMessages();
    all.push(message);
    saveLocalMessages(all);
    const [enriched] = await enrichMessages([message]);
    return enriched;
  }

  let insertPayload: Record<string, unknown> = {
    title,
    body,
    project_id: input.projectId,
    category: input.category,
    author_username: input.author.username,
    author_display_name: input.author.displayName,
    linked_task_id: linkedTaskId,
    linked_task_ids: linkedTaskIds,
  };

  let { data, error } = await (await db())
    .from('team_messages')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error && /linked_task_ids|column/i.test(error.message)) {
    insertPayload = {
      title,
      body,
      project_id: input.projectId,
      category: input.category,
      author_username: input.author.username,
      author_display_name: input.author.displayName,
      linked_task_id: linkedTaskId,
    };
    ({ data, error } = await (await db())
      .from('team_messages')
      .insert(insertPayload)
      .select('*')
      .single());
  }

  if (error && /title|project_id|category|column/i.test(error.message)) {
    throw new Error(
      'Messages need title and project fields. Run supabase/migrations/029_team_message_title_project.sql in Supabase.'
    );
  }

  if (error) throw error;
  const message = mapRow(data as Record<string, unknown>);
  const [enriched] = await enrichMessages([message]);
  return enriched;
}

export async function updateTeamMessage(
  messageId: string,
  input: UpdateTeamMessageInput,
  actorUsername: string
): Promise<TeamMessage> {
  const title = input.title.trim();
  const body = normalizeOutgoingMessageBody(input.body);
  const bodyPlain = messageBodyToPlainText(body);
  if (!title) throw new Error('Message title is required.');
  if (!htmlMessageHasContent(body)) throw new Error('Message cannot be empty.');
  if (!input.projectId) throw new Error('Choose a project for this message.');
  if (!input.category) throw new Error('Choose a category for this message.');
  if (!actorUsername.trim()) throw new Error('You must be logged in to edit a message.');

  if (isLocalTaskboardMode()) {
    const all = loadLocalMessages();
    const index = all.findIndex((m) => m.id === messageId);
    if (index < 0) throw new Error('Message not found.');
    if (!authorUsernamesMatch(all[index].author_username, actorUsername)) {
      throw new Error('You can only edit your own messages.');
    }
    const updated: TeamMessage = {
      ...all[index],
      title,
      body,
      project_id: input.projectId,
      category: input.category,
    };
    all[index] = updated;
    saveLocalMessages(all);
    const [enriched] = await enrichMessages([updated]);
    return enriched;
  }

  const { data, error } = await (await db())
    .from('team_messages')
    .update({
      title,
      body,
      project_id: input.projectId,
      category: input.category,
    })
    .eq('id', messageId)
    .select('*')
    .single();

  if (error) {
    if (/42501|permission|policy/i.test(error.message)) {
      throw new Error('You can only edit your own messages.');
    }
    if (/title|project_id|category|column/i.test(error.message)) {
      throw new Error(
        'Messages need title and project fields. Run supabase/migrations/029_team_message_title_project.sql in Supabase.'
      );
    }
    throw error;
  }

  if (!data) throw new Error('Message not found.');
  const row = mapRow(data as Record<string, unknown>);
  if (!authorUsernamesMatch(row.author_username, actorUsername)) {
    throw new Error('You can only edit your own messages.');
  }
  const [enriched] = await enrichMessages([row]);
  return enriched;
}

async function deleteTeamMessageViaApi(messageId: string): Promise<'ok' | 'unavailable'> {
  let res: Response;
  try {
    res = await fetch('/api/messages/delete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
  } catch {
    return 'unavailable';
  }

  if (res.status === 503) {
    return 'unavailable';
  }

  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof payload.error === 'string' ? payload.error : 'Could not delete message.'
    );
  }
  return 'ok';
}

export async function deleteTeamMessage(
  messageId: string,
  actorUsername: string
): Promise<void> {
  if (!actorUsername.trim()) throw new Error('You must be logged in to delete a message.');

  if (isLocalTaskboardMode()) {
    const all = loadLocalMessages();
    const target = all.find((m) => m.id === messageId);
    if (!target) return;
    if (!authorUsernamesMatch(target.author_username, actorUsername)) {
      throw new Error('You can only delete your own messages.');
    }
    saveLocalMessages(all.filter((m) => m.id !== messageId));
    return;
  }

  if (isSupabaseConfigured()) {
    const viaApi = await deleteTeamMessageViaApi(messageId);
    if (viaApi === 'ok') return;
  }

  const { data, error } = await (await db())
    .from('team_messages')
    .delete()
    .eq('id', messageId)
    .select('id');

  if (error) {
    if (/42501|permission|policy/i.test(error.message)) {
      throw new Error(
        'You can only delete your own messages. If this persists, run supabase/migrations/030_team_messages_author_edit.sql and 031_team_messages_delete_case_insensitive.sql.'
      );
    }
    throw error;
  }

  if (!data?.length) {
    throw new Error(
      'Message could not be deleted. Run supabase/migrations/030_team_messages_author_edit.sql in Supabase if you have not already.'
    );
  }
}

export function subscribeToTeamMessages(onChange: () => void) {
  if (isLocalTaskboardMode()) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) onChange();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  let channel: ReturnType<Awaited<ReturnType<typeof db>>['channel']> | null = null;
  let cancelled = false;

  void (async () => {
    const supabase = await db();
    if (cancelled) return;
    channel = supabase
      .channel('team_messages_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_messages' },
        () => onChange()
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    void channel?.unsubscribe();
  };
}
