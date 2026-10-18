import { handleParseActionPoints } from '../parseActionPoints.js';
import { requireMessageAreaAccess } from '../messageAccess.js';

export default async function handler(req, res) {
  const auth = await requireMessageAreaAccess(req, res);
  if (!auth) return;

  const username = auth.username;
  const isAdmin = auth.isAdmin;

  try {
    return await handleParseActionPoints(req, res, { username, isAdmin });
  } catch (err) {
    console.error('Parse action points API error:', err);
    return res.status(500).json({ error: 'Could not parse action points.' });
  }
}
