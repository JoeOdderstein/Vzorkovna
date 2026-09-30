import { handleCreateMember, handleListMembers } from '../_lib/members.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleListMembers(req, res);
    if (req.method === 'POST') return await handleCreateMember(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Members API error:', err);
    return res.status(500).json({ error: 'Could not process members request' });
  }
}
