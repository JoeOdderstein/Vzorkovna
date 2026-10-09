import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { sendTeamMessageEmail } from './email.js';
import { buildMessageBodyHtmlForEmail } from './messageBodyForEmail.js';
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

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export async function handleNotifyTeamMessage(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const excludedUsernames = Array.isArray(body.excludedUsernames)
    ? body.excludedUsernames.map(normalizeUsername).filter(Boolean)
    : [];

  if (!messageId) {
    return res.status(400).json({ error: 'messageId is required' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: message, error: messageError } = await supabase
    .from('team_messages')
    .select('id, title, body, author_username, author_display_name')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError || !message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const authorName =
    String(message.author_display_name ?? '').trim() ||
    defaultBoardNameForUsername(message.author_username) ||
    message.author_username;

  const messageBodyHtml = await buildMessageBodyHtmlForEmail(
    supabase,
    String(message.body ?? '')
  );

  const excluded = new Set(excludedUsernames);
  const messagesUrl = siteBaseUrl() ? `${siteBaseUrl()}/messages` : '';

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('username, email, board_name')
    .order('board_name', { ascending: true });

  if (profileError) {
    console.error('Team message notify profiles failed:', profileError);
    return res.status(500).json({ error: 'Could not load recipients' });
  }

  let sent = 0;
  const failures = [];

  for (const row of profiles ?? []) {
    const username = normalizeUsername(row.username);
    const email = String(row.email ?? '').trim();
    if (!username || !email || excluded.has(username)) continue;

    const recipientName =
      String(row.board_name ?? '').trim() || defaultBoardNameForUsername(username) || username;

    try {
      await sendTeamMessageEmail({
        to: email,
        recipientName,
        authorName,
        messageTitle: String(message.title ?? 'Team message'),
        messageBodyHtml,
        messagesUrl,
      });
      sent += 1;
    } catch (err) {
      console.error('Team message notify email failed:', username, err);
      failures.push(username);
    }
  }

  return res.status(200).json({ sent, failed: failures.length });
}
