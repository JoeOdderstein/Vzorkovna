import { handleNotifyInvoiceUpload } from '../notifyInvoiceUpload.js';

export default async function handler(req, res) {
  try {
    return await handleNotifyInvoiceUpload(req, res);
  } catch (err) {
    console.error('Notify invoice upload API error:', err);
    return res.status(500).json({ error: 'Could not send invoice notifications' });
  }
}
