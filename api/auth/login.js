import {
  createSessionToken,
  getAuthConfigError,
  isAdminUsername,
  setSessionCookie,
  validateCredentials,
} from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const configError = getAuthConfigError();
    if (configError) {
      return res.status(503).json({ error: configError });
    }

    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (!validateCredentials(String(username), String(password))) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const normalizedUsername = String(username);
    const token = await createSessionToken(normalizedUsername);
    setSessionCookie(res, token);

    return res.status(200).json({
      ok: true,
      accessToken: token,
      username: normalizedUsername,
      isAdmin: isAdminUsername(normalizedUsername),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}
