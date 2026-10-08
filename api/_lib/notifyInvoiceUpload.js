import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { sendInvoiceUploadEmail } from './email.js';
import { userCanAccessInvoices } from './invoiceAccess.js';
import { getTokenFromRequest, isAdminUsername, verifySessionToken } from './auth.js';
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

export async function handleNotifyInvoiceUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let uploaderUsername;
  let uploaderIsAdmin = false;
  try {
    const claims = await verifySessionToken(token);
    uploaderUsername = typeof claims.username === 'string' ? claims.username : null;
    uploaderIsAdmin = isAdminUsername(uploaderUsername);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!uploaderUsername) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const canAccess = await userCanAccessInvoices(uploaderUsername, uploaderIsAdmin);
  if (!canAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = readRequestBody(req);
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
  const notifyUsernames = Array.isArray(body.notifyUsernames)
    ? body.notifyUsernames.filter((u) => typeof u === 'string' && u.trim())
    : [];

  if (!invoiceId) {
    return res.status(400).json({ error: 'invoiceId is required' });
  }

  if (notifyUsernames.length === 0) {
    return res.status(200).json({ ok: true, results: [] });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, title, uploaded_by, created_at')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const uploaderProfile = await profileByUsername(supabase, uploaderUsername);
  const ownerProfile = await profileByUsername(supabase, invoice.uploaded_by);
  const uploaderName =
    uploaderProfile?.board_name ??
    defaultBoardNameForUsername(uploaderUsername) ??
    uploaderUsername;
  const ownerName =
    ownerProfile?.board_name ??
    defaultBoardNameForUsername(invoice.uploaded_by) ??
    invoice.uploaded_by;

  const invoicesUrl = siteBaseUrl() ? `${siteBaseUrl()}/invoices` : '/invoices';

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
      await sendInvoiceUploadEmail({
        to: email,
        recipientName,
        uploaderName,
        ownerName,
        invoiceTitle: invoice.title,
        invoicesUrl,
      });
      results.push({ username, sent: true });
    } catch (err) {
      console.error('Invoice notify email failed:', username, err);
      results.push({ username, sent: false, reason: 'send_failed' });
    }
  }

  return res.status(200).json({ ok: true, results });
}
