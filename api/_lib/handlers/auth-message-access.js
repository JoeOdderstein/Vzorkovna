import {
  handleGetMessageAccess,
  handleGrantMessageAccess,
  handleRevokeMessageAccess,
} from '../messageAccess.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGetMessageAccess(req, res);
    if (req.method === 'POST') return await handleGrantMessageAccess(req, res);
    if (req.method === 'DELETE') return await handleRevokeMessageAccess(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Message access API error:', err);
    return res.status(500).json({ error: 'Could not process message access request' });
  }
}
