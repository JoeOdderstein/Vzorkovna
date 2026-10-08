import {
  handleGetInvoiceAccess,
  handleGrantInvoiceAccess,
  handleRevokeInvoiceAccess,
} from '../invoiceAccess.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGetInvoiceAccess(req, res);
    if (req.method === 'POST') return await handleGrantInvoiceAccess(req, res);
    if (req.method === 'DELETE') return await handleRevokeInvoiceAccess(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Invoice access API error:', err);
    return res.status(500).json({ error: 'Could not process invoice access request' });
  }
}
