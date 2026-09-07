import { getTokenFromRequest, verifySessionToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ authenticated: false });
    }

    await verifySessionToken(token);
    return res.status(200).json({ authenticated: true, accessToken: token });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
}
