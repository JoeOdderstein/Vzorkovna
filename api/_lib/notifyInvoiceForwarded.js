import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { sendInvoiceForwardedEmail } from './email.js';
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

export async function handleNotifyInvoiceForwarded(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let actorUsername;
  try {
    const claims = await verifySessionToken(token);
    actorUsername = typeof claims.username === 'string' ? claims.username : null;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!actorUsername) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const actorIsAdmin = isAdminUsername(actorUsername);
  const canAccess = await userCanAccessInvoices(actorUsername, actorIsAdmin);
  if (!canAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = readRequestBody(req);
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';

  if (!invoiceId) {
    return res.status(400).json({ error: 'invoiceId is required' });
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
    .select(
      'id, title, uploaded_by, forwarded_to_finance, forwarded_to_finance_by, forwarded_to_finance_at',
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (!invoice.forwarded_to_finance) {
    return res.status(400).json({ error: 'Invoice is not marked as forwarded to finance' });
  }

  const uploaderUsername = String(invoice.uploaded_by ?? '').trim().toLowerCase();
  if (!uploaderUsername) {
    return res.status(400).json({ error: 'Invoice has no uploader' });
  }

  if (uploaderUsername === actorUsername.trim().toLowerCase()) {
    return res.status(200).json({ ok: true, sent: false, reason: 'self' });
  }

  const uploaderProfile = await profileByUsername(supabase, uploaderUsername);
  const email = uploaderProfile?.email?.trim();
  if (!email) {
    return res.status(200).json({ ok: true, sent: false, reason: 'no_email' });
  }

  const actorProfile = await profileByUsername(supabase, actorUsername);
  const actorName =
    actorProfile?.board_name ??
    defaultBoardNameForUsername(actorUsername) ??
    actorUsername;
  const ownerName =
    uploaderProfile?.board_name ??
    defaultBoardNameForUsername(uploaderUsername) ??
    uploaderUsername;

  const invoicesUrl = siteBaseUrl() ? `${siteBaseUrl()}/invoices` : '/invoices';

  try {
    await sendInvoiceForwardedEmail({
      to: email,
      recipientName: ownerName,
      actorName,
      invoiceTitle: invoice.title,
      invoicesUrl,
    });
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('Invoice forwarded notify failed:', err);
    return res.status(500).json({ error: 'Could not send email' });
  }
}
