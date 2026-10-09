import { getTokenFromRequest, isAdminUsername, verifySessionToken } from '../auth.js';
import { handleSuggestMessageProject } from '../parseMessageProject.js';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let claims;
  try {
    claims = await verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const username = typeof claims.username === 'string' ? claims.username : '';
  const isAdmin = isAdminUsername(username);

  try {
    return await handleSuggestMessageProject(req, res, { username, isAdmin });
  } catch (err) {
    console.error('Suggest message project API error:', err);
    return res.status(500).json({ error: 'Could not suggest project.' });
  }
}
