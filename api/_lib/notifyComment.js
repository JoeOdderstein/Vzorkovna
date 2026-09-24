import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { normalizeAssignees } from './assigneeUsername.js';
import { sendCommentNotificationEmail } from './email.js';
import { getTokenFromRequest, verifySessionToken } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { findProfileForAssignee } from './profileForAssignee.js';

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

async function boardNameForUsername(supabase, username) {
  if (!username) return null;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('board_name')
    .eq('username', username)
    .maybeSingle();
  return profile?.board_name ?? defaultBoardNameForUsername(username);
}

export async function handleNotifyComment(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let commenterUsername;
  try {
    const claims = await verifySessionToken(token);
    commenterUsername = typeof claims.username === 'string' ? claims.username : null;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const taskId = typeof body.taskId === 'string' ? body.taskId : '';
  const commentId = typeof body.commentId === 'string' ? body.commentId : '';

  if (!taskId || !commentId) {
    return res.status(400).json({ error: 'taskId and commentId are required' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: comment, error: commentError } = await supabase
    .from('task_comments')
    .select('id, task_id, author_username, author_display_name, body')
    .eq('id', commentId)
    .maybeSingle();

  if (commentError) {
    console.error('Notify comment lookup failed:', commentError);
    return res.status(500).json({ error: 'Could not load comment', detail: commentError.message });
  }

  if (!comment || comment.task_id !== taskId) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  const authorUsername = String(comment.author_username ?? '').toLowerCase();
  const sessionUsername = String(commenterUsername ?? '').toLowerCase();
  if (sessionUsername && authorUsername && authorUsername !== sessionUsername) {
    return res.status(403).json({ error: 'Comment author mismatch' });
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, task_name, assignees, project_id')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) {
    console.error('Notify comment task lookup failed:', taskError);
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
      console.error('Notify comment project lookup failed:', projectError);
    } else if (projectRow) {
      project = projectRow;
    }
  }

  const assignees = normalizeAssignees(task.assignees);
  const commenterBoardName =
    (await boardNameForUsername(supabase, comment.author_username)) ||
    comment.author_display_name?.trim() ||
    comment.author_username;

  // Notify every assignee (including the commenter when they are assigned).
  const recipients = [...assignees];

  const siteUrl = (process.env.TASKBOARD_SITE_URL ?? '').replace(/\/$/, '');
  const taskUrl =
    siteUrl && project.slug
      ? `${siteUrl}/taskboard?open=${encodeURIComponent(project.slug)}&task=${encodeURIComponent(task.id)}`
      : null;

  let notified = 0;
  const failures = [];
  const skipped = [];

  if (assignees.length === 0) {
    return res.status(200).json({
      ok: true,
      notified: 0,
      skipped: [{ assignee: null, reason: 'task_has_no_assignees' }],
      assignees,
      recipients,
      commenterBoardName,
    });
  }

  for (const assignee of recipients) {
    const { profile, reason: profileReason } = await findProfileForAssignee(supabase, assignee);

    if (!profile) {
      skipped.push({ assignee, reason: profileReason ?? 'no_profile_for_board_name' });
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
      await sendCommentNotificationEmail({
        to: profile.email,
        assigneeName: assignee,
        commenterName: comment.author_display_name?.trim() || commenterBoardName,
        taskName: task.task_name || 'Untitled task',
        projectName: project.name || 'Taskboard',
        commentBody: comment.body,
        taskUrl,
      });
      notified += 1;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`Comment email failed for ${profile.email}:`, detail, err);
      failures.push(assignee);
      skipped.push({ assignee, reason: 'send_failed', email: profile.email, detail });
    }
  }

  return res.status(200).json({
    ok: true,
    notified,
    failures,
    skipped,
    assignees,
    recipients,
    commenterBoardName,
  });
}
