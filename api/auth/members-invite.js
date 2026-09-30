import { handleSendInvite } from '../_lib/members.js';

export default async function handler(req, res) {
  try {
    return await handleSendInvite(req, res);
  } catch (err) {
    console.error('Member invite error:', err);
    return res.status(500).json({ error: 'Could not send invite' });
  }
}
