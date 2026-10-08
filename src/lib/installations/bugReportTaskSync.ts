import { defaultBoardNameForUsername } from '../taskboard/boardNameUtils';
import { createTask, deleteTask, updateTask } from '../taskboard/taskService';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from '../taskboard/config';
import type { InstallationRepair } from './types';
import { notifyInstallationsUpdated } from './localInstallationOverrides';
import { syncInstallationLifecycleFromOpenBugs } from './installationLifecycleSync';

const BUG_PROJECT_SLUG = 'installation-bugs';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function siteBaseUrl() {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  return fromEnv?.trim().replace(/\/$/, '') ?? '';
}

function buildBugTaskDescription(params: {
  installationName: string;
  installationId: string;
  repairId: string;
  notes: string;
  reportedBy: string | null;
  occurredOn: string;
}) {
  const lines = [params.notes.trim(), ''];
  lines.push('—');
  lines.push(`Installation: ${params.installationName}`);
  if (params.reportedBy) lines.push(`Reported by: ${params.reportedBy}`);
  lines.push(`Report date: ${params.occurredOn}`);
  const url = siteBaseUrl()
    ? `${siteBaseUrl()}/projects/installation/${params.installationId}`
    : '';
  if (url) lines.push(`Open installation: ${url}`);
  lines.push(`Bug report ID: ${params.repairId}`);
  return lines.join('\n');
}

async function assigneesFromNotifyUsernames(
  usernames: string[],
): Promise<string[]> {
  if (usernames.length === 0) return [];

  const supabase = await db();
  const assignees: string[] = [];

  for (const raw of usernames) {
    const username = raw.trim().toLowerCase();
    if (!username) continue;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('board_name, username')
      .eq('username', username)
      .maybeSingle();

    const label =
      profile?.board_name?.trim() ||
      defaultBoardNameForUsername(username) ||
      profile?.username ||
      raw;
    assignees.push(label);
  }

  return [...new Set(assignees)];
}

async function resolveTaskProjectId(
  installationId: string,
  installationName: string,
): Promise<string | null> {
  const supabase = await db();

  const { data: installation } = await supabase
    .from('installations')
    .select('taskboard_project_id')
    .eq('id', installationId)
    .maybeSingle();

  if (installation?.taskboard_project_id) {
    return String(installation.taskboard_project_id);
  }

  const { data: byInstallSlug } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', installationId)
    .maybeSingle();
  if (byInstallSlug?.id) return String(byInstallSlug.id);

  const { data: projects } = await supabase.from('projects').select('id, slug, name');
  const nameLower = installationName.trim().toLowerCase();
  const idLower = installationId.trim().toLowerCase();

  for (const row of projects ?? []) {
    const slug = String(row.slug ?? '').toLowerCase();
    const name = String(row.name ?? '').toLowerCase();
    if (name && name === nameLower) return String(row.id);
    if (slug && (slug === idLower || idLower.includes(slug) || slug.includes(idLower))) {
      return String(row.id);
    }
  }

  const { data: fallback } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', BUG_PROJECT_SLUG)
    .maybeSingle();
  if (fallback?.id) return String(fallback.id);

  const first = projects?.[0];
  return first?.id ? String(first.id) : null;
}

export async function createLinkedTaskForBugReport(
  repair: InstallationRepair,
  installationName: string,
): Promise<void> {
  if (!isSupabaseConfigured() || repair.kind !== 'bug_report') return;

  const projectId = await resolveTaskProjectId(repair.installation_id, installationName);
  if (!projectId) {
    console.warn('[bug-task-sync] No taskboard project found for bug report', repair.id);
    return;
  }

  const assignees = await assigneesFromNotifyUsernames(repair.notify_usernames);
  const taskName = `[${installationName}] ${repair.summary}`;

  try {
    const task = await createTask(
      {
        project_id: projectId,
        category: 'repairs',
        task_name: taskName,
        description: buildBugTaskDescription({
          installationName,
          installationId: repair.installation_id,
          repairId: repair.id,
          notes: repair.notes,
          reportedBy: repair.reported_by,
          occurredOn: repair.occurred_on,
        }),
        assignees,
        priority: 'high',
      },
      { skipAssignmentNotify: true },
    );

    const supabase = await db();
    await supabase
      .from('installation_repairs')
      .update({ linked_task_id: task.id })
      .eq('id', repair.id);
  } catch (err) {
    console.warn('[bug-task-sync] Could not create linked task:', err);
  }
}

export async function syncLinkedTaskFromBugEdit(repairId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await db();
  const { data: repairRow } = await supabase
    .from('installation_repairs')
    .select(
      'id, installation_id, summary, notes, occurred_on, reported_by, notify_usernames, kind, linked_task_id, resolved',
    )
    .eq('id', repairId)
    .maybeSingle();

  if (!repairRow || repairRow.kind !== 'bug_report' || !repairRow.linked_task_id) return;

  const { data: installation } = await supabase
    .from('installations')
    .select('name')
    .eq('id', repairRow.installation_id)
    .maybeSingle();

  const installationName = installation?.name ?? String(repairRow.installation_id);
  const notifyUsernames = Array.isArray(repairRow.notify_usernames)
    ? repairRow.notify_usernames.map(String)
    : [];
  const assignees = await assigneesFromNotifyUsernames(notifyUsernames);

  await updateTask(
    String(repairRow.linked_task_id),
    {
      task_name: `[${installationName}] ${repairRow.summary}`,
      description: buildBugTaskDescription({
        installationName,
        installationId: String(repairRow.installation_id),
        repairId: String(repairRow.id),
        notes: String(repairRow.notes ?? ''),
        reportedBy: repairRow.reported_by ? String(repairRow.reported_by) : null,
        occurredOn: String(repairRow.occurred_on),
      }),
      assignees,
    },
    { skipBugSync: true },
  );
}

export async function syncTaskFromBugResolution(
  repairId: string,
  resolved: boolean,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await db();
  const { data: repair } = await supabase
    .from('installation_repairs')
    .select('linked_task_id, kind')
    .eq('id', repairId)
    .maybeSingle();

  if (!repair?.linked_task_id || repair.kind !== 'bug_report') return;

  const taskId = String(repair.linked_task_id);
  const { data: task } = await supabase
    .from('tasks')
    .select('completed')
    .eq('id', taskId)
    .maybeSingle();

  if (!task || Boolean(task.completed) === resolved) return;

  await updateTask(taskId, { completed: resolved }, { skipBugSync: true });
}

export async function syncBugFromTaskCompletion(
  taskId: string,
  completed: boolean,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await db();
  const { data: repair } = await supabase
    .from('installation_repairs')
    .select('id, installation_id, resolved, kind')
    .eq('linked_task_id', taskId)
    .maybeSingle();

  if (!repair || repair.kind !== 'bug_report') return;
  if (Boolean(repair.resolved) === completed) return;

  const { error } = await supabase
    .from('installation_repairs')
    .update({ resolved: completed })
    .eq('id', repair.id);

  if (!error) {
    notifyInstallationsUpdated();
    await syncInstallationLifecycleFromOpenBugs(String(repair.installation_id));
  }
}

export async function deleteLinkedTaskForBugRepair(repairId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await db();
  const { data: repair } = await supabase
    .from('installation_repairs')
    .select('linked_task_id, kind')
    .eq('id', repairId)
    .maybeSingle();

  if (!repair?.linked_task_id || repair.kind !== 'bug_report') return;

  try {
    await deleteTask(String(repair.linked_task_id));
  } catch (err) {
    console.warn('[bug-task-sync] Could not delete linked task:', err);
  }
}
