import { normalizeAssignees } from './assigneeUsername.js';
import { sendAssignmentEmail } from './email.js';
import { getTokenFromRequest, verifySessionToken } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

function readRequestBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body;
}

export async function handleNotifyAssignment(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let assignedBy;
  try {
    const claims = await verifySessionToken(token);
    assignedBy = typeof claims.username === 'string' ? claims.username : null;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const taskId = typeof body.taskId === 'string' ? body.taskId : '';
  const previousAssignees = normalizeAssignees(body.previousAssignees);

  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, task_name, description, assignees, deadline, project_id')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) {
    console.error('Notify assignment task lookup failed:', taskError);
    return res.status(500).json({ error: 'Could not load task', detail: taskError.message });
  }

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  let project = { name: 'Taskboard', slug: null };
  if (task.project_id) {
    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('name, slug')
      .eq('id', task.project_id)
      .maybeSingle();

    if (projectError) {
      console.error('Notify assignment project lookup failed:', projectError);
    } else if (projectRow) {
      project = projectRow;
    }
  }

  const currentAssignees = normalizeAssignees(task.assignees);
  const previousSet = new Set(previousAssignees);
  const newAssignees = currentAssignees.filter((assignee) => !previousSet.has(assignee));

  const { data: assignerProfile } = assignedBy
    ? await supabase
        .from('user_profiles')
        .select('board_name')
        .eq('username', assignedBy)
        .maybeSingle()
    : { data: null };

  const assignerBoardName = assignerProfile?.board_name ?? null;
  const siteUrl = (process.env.TASKBOARD_SITE_URL ?? '').replace(/\/$/, '');
  const taskUrl =
    siteUrl && project.slug
      ? `${siteUrl}/taskboard?open=${encodeURIComponent(project.slug)}&task=${encodeURIComponent(task.id)}`
      : null;

  let notified = 0;
  const failures = [];
  const skipped = [];

  if (newAssignees.length === 0) {
    return res.status(200).json({
      ok: true,
      notified: 0,
      skipped: [{ assignee: null, reason: 'no_new_assignees' }],
      currentAssignees,
      previousAssignees,
    });
  }

  for (const assignee of newAssignees) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email, notify_on_assign, board_name, username')
      .eq('board_name', assignee)
      .maybeSingle();

    if (profileError) {
      console.error(`Profile lookup failed for board name ${assignee}:`, profileError);
      failures.push(assignee);
      skipped.push({ assignee, reason: 'profile_lookup_failed' });
      continue;
    }

    if (!profile) {
      skipped.push({ assignee, reason: 'no_profile_for_board_name' });
      continue;
    }

    if (!profile.email) {
      skipped.push({ assignee, reason: 'no_email_on_profile', username: profile.username });
      continue;
    }

    if (profile.notify_on_assign === false) {
      skipped.push({ assignee, reason: 'notifications_disabled', username: profile.username });
      continue;
    }

    try {
      await sendAssignmentEmail({
        to: profile.email,
        assigneeName: assignee,
        assignedBy: assignerBoardName ?? assignedBy ?? 'Someone',
        taskName: task.task_name || 'Untitled task',
        description: task.description,
        projectName: project.name || 'Taskboard',
        deadline: task.deadline,
        taskUrl,
      });
      notified += 1;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`Assignment email failed for ${profile.email}:`, detail, err);
      failures.push(assignee);
      skipped.push({ assignee, reason: 'send_failed', email: profile.email, detail });
    }
  }

  return res.status(200).json({ ok: true, notified, failures, skipped });
}
