import {
  createSessionToken,
  getAuthConfigError,
  isAdminUsername,
  setSessionCookie,
} from '../auth.js';
import { userCanAccessInvoices } from '../invoiceAccess.js';
import { authenticateUser } from '../authenticate.js';

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

    const normalizedUsername = await authenticateUser(String(username), String(password));

    if (!normalizedUsername) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const token = await createSessionToken(normalizedUsername);
    setSessionCookie(res, token);

    const isAdmin = isAdminUsername(normalizedUsername);
    const canAccessInvoices = await userCanAccessInvoices(normalizedUsername, isAdmin);

    return res.status(200).json({
      ok: true,
      accessToken: token,
      username: normalizedUsername,
      isAdmin,
      canAccessInvoices,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}
