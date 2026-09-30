import { handleAcceptInvite, handleGetInvite } from '../_lib/members.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGetInvite(req, res);
    if (req.method === 'POST') return await handleAcceptInvite(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Invite API error:', err);
    return res.status(500).json({ error: 'Could not process invite' });
  }
}
