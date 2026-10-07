import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { sendRepairCommentNotificationEmail } from './email.js';
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

function siteBaseUrl() {
  return (
    process.env.VITE_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '') ||
    process.env.TASKBOARD_SITE_URL?.trim()?.replace(/\/$/, '') ||
    ''
  );
}

async function profileByUsername(supabase, username) {
  const { data } = await supabase
    .from('user_profiles')
    .select('username, email, board_name, notify_on_assign')
    .eq('username', username)
    .maybeSingle();
  return data;
}

export async function handleNotifyRepairComment(req, res) {
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
  const repairId = typeof body.repairId === 'string' ? body.repairId : '';
  const commentId = typeof body.commentId === 'string' ? body.commentId : '';
  const installationId = typeof body.installationId === 'string' ? body.installationId : '';

  if (!repairId || !commentId || !installationId) {
    return res.status(400).json({ error: 'repairId, commentId, and installationId are required' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: comment, error: commentError } = await supabase
    .from('installation_repair_comments')
    .select('id, repair_id, author_username, author_display_name, body')
    .eq('id', commentId)
    .maybeSingle();

  if (commentError) {
    console.error('Notify repair comment lookup failed:', commentError);
    return res.status(500).json({ error: 'Could not load comment', detail: commentError.message });
  }

  if (!comment || comment.repair_id !== repairId) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  const authorUsername = String(comment.author_username ?? '').toLowerCase();
  const sessionUsername = String(commenterUsername ?? '').toLowerCase();
  if (sessionUsername && authorUsername && authorUsername !== sessionUsername) {
    return res.status(403).json({ error: 'Comment author mismatch' });
  }

  const { data: repair, error: repairError } = await supabase
    .from('installation_repairs')
    .select('id, installation_id, summary, notify_usernames, kind')
    .eq('id', repairId)
    .maybeSingle();

  if (repairError || !repair || repair.installation_id !== installationId) {
    return res.status(404).json({ error: 'Repair entry not found' });
  }

  const notifyUsernames = Array.isArray(repair.notify_usernames)
    ? repair.notify_usernames.filter((u) => typeof u === 'string' && u.trim())
    : [];

  const { data: installation } = await supabase
    .from('installations')
    .select('id, name')
    .eq('id', installationId)
    .maybeSingle();

  const commenterProfile = comment.author_username
    ? await profileByUsername(supabase, comment.author_username)
    : null;
  const commenterName =
    comment.author_display_name?.trim() ||
    commenterProfile?.board_name ||
    defaultBoardNameForUsername(comment.author_username) ||
    comment.author_username ||
    'Someone';

  const projectUrl = siteBaseUrl()
    ? `${siteBaseUrl()}/projects/installation/${installationId}`
    : '';

  let notified = 0;
  const skipped = [];

  if (notifyUsernames.length === 0) {
    return res.status(200).json({
      ok: true,
      notified: 0,
      skipped: [{ username: null, reason: 'no_notify_usernames' }],
    });
  }

  for (const username of notifyUsernames) {
    const profile = await profileByUsername(supabase, username);
    if (!profile?.email?.trim()) {
      skipped.push({ username, reason: 'no_email' });
      continue;
    }
    if (profile.notify_on_assign === false) {
      skipped.push({ username, reason: 'notifications_disabled' });
      continue;
    }

    const recipientName =
      profile.board_name ?? defaultBoardNameForUsername(username) ?? username;

    try {
      await sendRepairCommentNotificationEmail({
        to: profile.email.trim(),
        recipientName,
        commenterName,
        projectName: installation?.name ?? installationId,
        bugTitle: repair.summary ?? 'Bug report',
        commentBody: comment.body,
        projectUrl,
      });
      notified += 1;
    } catch (err) {
      console.error('Repair comment email failed:', username, err);
      skipped.push({ username, reason: 'send_failed' });
    }
  }

  return res.status(200).json({ ok: true, notified, skipped });
}
