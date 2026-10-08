import type {
  CreateTeamMessageInput,
  TeamMessage,
  TeamMessageLinkedTask,
} from './types';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { createTask, isLocalTaskboardMode } from '../taskboard/taskService';
import { normalizeAssignees } from '../taskboard/assigneeUtils';
import { readLocalTasks } from '../taskboard/localTasksStorage';
import { localStore } from '../taskboard/localStore';

const LOCAL_STORAGE_KEY = 'team_messages_v1';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapRow(row: Record<string, unknown>): TeamMessage {
  return {
    id: String(row.id),
    body: String(row.body ?? ''),
    author_username: String(row.author_username ?? ''),
    author_display_name: String(row.author_display_name ?? ''),
    linked_task_id: row.linked_task_id ? String(row.linked_task_id) : null,
    created_at: String(row.created_at ?? ''),
    linked_task: null,
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

function enrichLocalLinkedTasks(messages: TeamMessage[]): TeamMessage[] {
  const tasks = readLocalTasks();
  const projects = localStore.getProjects();
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return messages.map((message) => {
    if (!message.linked_task_id) return message;
    const task = tasks.find((t) => t.id === message.linked_task_id);
    if (!task) return message;
    const project = projectById.get(task.project_id);
    const linked_task: TeamMessageLinkedTask = {
      id: task.id,
      task_name: task.task_name,
      assignees: task.assignees,
      project: project ? { name: project.name, slug: project.slug } : null,
    };
    return { ...message, linked_task };
  });
}

async function enrichLinkedTasks(messages: TeamMessage[]): Promise<TeamMessage[]> {
  const ids = [...new Set(messages.map((m) => m.linked_task_id).filter(Boolean))] as string[];
  if (ids.length === 0) return messages;

  const { data, error } = await (await db())
    .from('tasks')
    .select('id, task_name, assignees, project:projects(name, slug)')
    .in('id', ids);

  if (error) throw error;

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
    if (!message.linked_task_id) return message;
    return { ...message, linked_task: byId.get(message.linked_task_id) ?? null };
  });
}

export async function isTeamMessagesReady() {
  if (isLocalTaskboardMode()) return true;
  const { error } = await (await db()).from('team_messages').select('id').limit(1);
  return !error;
}

export async function fetchTeamMessages(limit = 80): Promise<TeamMessage[]> {
  if (isLocalTaskboardMode()) {
    return enrichLocalLinkedTasks(loadLocalMessages()).slice(-limit).reverse();
  }

  const { data, error } = await (await db())
    .from('team_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const messages = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  const enriched = await enrichLinkedTasks(messages);
  return enriched.reverse();
}

export async function createTeamMessage(input: CreateTeamMessageInput): Promise<TeamMessage> {
  const body = input.body.trim();
  if (!body) throw new Error('Message cannot be empty.');
  if (!input.author.username) throw new Error('You must be logged in to post.');

  let linkedTaskId: string | null = null;

  if (input.actionPoint) {
    const ap = input.actionPoint;
    const taskName = ap.taskName.trim();
    if (!taskName) throw new Error('Action point needs a title.');
    if (!ap.projectId) throw new Error('Choose a project for the action point.');

    const task = await createTask({
      project_id: ap.projectId,
      category: ap.category,
      task_name: taskName,
      description: body,
      assignees: ap.assignees ?? [],
    });
    linkedTaskId = task.id;
  }

  if (isLocalTaskboardMode()) {
    const message: TeamMessage = {
      id: crypto.randomUUID(),
      body,
      author_username: input.author.username,
      author_display_name: input.author.displayName,
      linked_task_id: linkedTaskId,
      created_at: new Date().toISOString(),
    };
    const all = loadLocalMessages();
    all.push(message);
    saveLocalMessages(all);
    const [enriched] = enrichLocalLinkedTasks([message]);
    return enriched;
  }

  const { data, error } = await (await db())
    .from('team_messages')
    .insert({
      body,
      author_username: input.author.username,
      author_display_name: input.author.displayName,
      linked_task_id: linkedTaskId,
    })
    .select('*')
    .single();

  if (error) throw error;
  const message = mapRow(data as Record<string, unknown>);
  const [enriched] = await enrichLinkedTasks([message]);
  return enriched;
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
