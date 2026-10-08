import { handleNotifyInvoiceForwarded } from '../notifyInvoiceForwarded.js';

export default async function handler(req, res) {
  try {
    return await handleNotifyInvoiceForwarded(req, res);
  } catch (err) {
    console.error('Notify invoice forwarded API error:', err);
    return res.status(500).json({ error: 'Could not send invoice notification' });
  }
}
