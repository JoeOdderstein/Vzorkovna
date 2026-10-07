import { handleListNotifyRecipients } from '../_lib/members.js';

export default async function handler(req, res) {
  try {
    return await handleListNotifyRecipients(req, res);
  } catch (err) {
    console.error('Notify recipients API error:', err);
    return res.status(500).json({ error: 'Could not load recipients' });
  }
}
