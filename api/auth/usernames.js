import {
  getAdminUsername,
  getTaskboardUsernames,
  getTokenFromRequest,
  isAdminUsername,
  verifySessionToken,
} from '../_lib/auth.js';
import { listMemberUsernames } from '../_lib/members.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const claims = await verifySessionToken(token);
    const username = typeof claims.username === 'string' ? claims.username : null;

    if (!isAdminUsername(username)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const adminUsername = getAdminUsername();

    let memberUsernames = [];
    try {
      memberUsernames = await listMemberUsernames();
    } catch (err) {
      console.error('Member username lookup failed:', err);
    }

    const usernames = [...new Set([...getTaskboardUsernames(), ...memberUsernames])].filter(
      (name) => name !== adminUsername
    );

    return res.status(200).json({ usernames, adminUsername });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
