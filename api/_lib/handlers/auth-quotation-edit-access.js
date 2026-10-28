import { requireAuthenticated } from '../invoiceAccess.js';
import {
  fetchQuotationEditorUsernames,
  setQuotationEditAccess,
} from '../quotationEditAccess.js';
import { userCanAccessInvoices } from '../invoiceAccess.js';

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

export async function handleGetQuotationEditAccess(req, res) {
  const auth = await requireAuthenticated(req, res);
  if (!auth) return;

  if (!auth.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { usernames, ready } = await fetchQuotationEditorUsernames();
    return res.status(200).json({ editors: usernames, quotationEditReady: ready });
  } catch (err) {
    console.error('List quotation editors failed:', err);
    return res.status(500).json({ error: 'Could not load quotation editors.' });
  }
}

export async function handleSetQuotationEditAccess(req, res) {
  const auth = await requireAuthenticated(req, res);
  if (!auth || !auth.isAdmin) {
    if (auth) res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = readRequestBody(req);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const enabled = body.enabled === true;

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const canSeeInvoices = await userCanAccessInvoices(username, false);
  if (!canSeeInvoices) {
    return res.status(400).json({ error: 'User must have Invoices access before they can edit budgets.' });
  }

  try {
    await setQuotationEditAccess(username, enabled, auth.username);
    return res.status(200).json({ ok: true, username, enabled });
  } catch (err) {
    console.error('Set quotation edit access failed:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not update quotation edit access.',
    });
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGetQuotationEditAccess(req, res);
    if (req.method === 'POST') return await handleSetQuotationEditAccess(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Quotation edit access API error:', err);
    return res.status(500).json({ error: 'Could not process quotation edit access request' });
  }
}
