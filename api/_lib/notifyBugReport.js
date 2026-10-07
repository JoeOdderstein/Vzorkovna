import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { sendBugReportEmail } from './email.js';
import { getTokenFromRequest, verifySessionToken } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { getInstallationDocumentSignedUrlsForEmail } from './installationPhotosForEmail.js';

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
  const login = String(username ?? '')
    .trim()
    .toLowerCase();
  if (!login) return null;
  const { data } = await supabase
    .from('user_profiles')
    .select('username, email, board_name')
    .eq('username', login)
    .maybeSingle();
  return data;
}

export async function handleNotifyBugReport(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let reporterUsername;
  try {
    const claims = await verifySessionToken(token);
    reporterUsername = typeof claims.username === 'string' ? claims.username : null;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const repairId = typeof body.repairId === 'string' ? body.repairId : '';
  const installationId = typeof body.installationId === 'string' ? body.installationId : '';
  const notifyUsernames = Array.isArray(body.notifyUsernames)
    ? body.notifyUsernames.filter((u) => typeof u === 'string' && u.trim())
    : [];

  if (!repairId || !installationId) {
    return res.status(400).json({ error: 'repairId and installationId are required' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: repair, error: repairError } = await supabase
    .from('installation_repairs')
    .select('id, installation_id, summary, notes, occurred_on, reported_by, kind, notify_usernames')
    .eq('id', repairId)
    .maybeSingle();

  if (repairError || !repair || repair.installation_id !== installationId) {
    return res.status(404).json({ error: 'Bug report not found' });
  }

  const existingNotify = Array.isArray(repair.notify_usernames)
    ? repair.notify_usernames.filter((u) => typeof u === 'string' && u.trim())
    : [];
  const normalize = (u) =>
    String(u ?? '')
      .trim()
      .toLowerCase();
  const mergedNotify = [
    ...new Set([...existingNotify, ...notifyUsernames].map(normalize).filter(Boolean)),
  ];
  if (notifyUsernames.length > 0) {
    await supabase
      .from('installation_repairs')
      .update({ notify_usernames: mergedNotify })
      .eq('id', repairId);
  }

  const { data: installation } = await supabase
    .from('installations')
    .select('id, name')
    .eq('id', installationId)
    .maybeSingle();

  const { data: photoRows } = await supabase
    .from('installation_documents')
    .select('storage_path')
    .eq('repair_id', repairId)
    .eq('kind', 'photo');

  const photoPaths = (photoRows ?? [])
    .map((row) => row.storage_path)
    .filter((path) => typeof path === 'string' && path);

  const photoUrls = await getInstallationDocumentSignedUrlsForEmail(photoPaths);

  const reporterProfile = reporterUsername
    ? await profileByUsername(supabase, reporterUsername)
    : null;
  const reporterName =
    reporterProfile?.board_name ??
    defaultBoardNameForUsername(reporterUsername) ??
    reporterUsername ??
    'Someone';

  const projectUrl = siteBaseUrl()
    ? `${siteBaseUrl()}/projects/installation/${installationId}`
    : '';

  const results = [];
  for (const username of notifyUsernames) {
    const profile = await profileByUsername(supabase, username);
    const email = profile?.email?.trim();
    if (!email) {
      results.push({ username, sent: false, reason: 'no_email' });
      continue;
    }

    const recipientName =
      profile.board_name ?? defaultBoardNameForUsername(username) ?? username;

    try {
      await sendBugReportEmail({
        to: email,
        recipientName,
        reporterName,
        projectName: installation?.name ?? installationId,
        bugTitle: repair.summary,
        description: repair.notes,
        occurredOn: repair.occurred_on,
        projectUrl,
        photoUrls,
        totalPhotoCount: photoPaths.length,
      });
      results.push({ username, sent: true });
    } catch (err) {
      console.error('Bug notify email failed:', username, err);
      results.push({ username, sent: false, reason: 'send_failed' });
    }
  }

  return res.status(200).json({ ok: true, results });
}
