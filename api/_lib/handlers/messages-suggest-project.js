import { handleSuggestMessageProject } from '../parseMessageProject.js';
import { requireMessageAreaAccess } from '../messageAccess.js';

export default async function handler(req, res) {
  const auth = await requireMessageAreaAccess(req, res);
  if (!auth) return;

  const username = auth.username;
  const isAdmin = auth.isAdmin;

  try {
    return await handleSuggestMessageProject(req, res, { username, isAdmin });
  } catch (err) {
    console.error('Suggest message project API error:', err);
    return res.status(500).json({ error: 'Could not suggest project.' });
  }
}
