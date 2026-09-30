import { validateCredentials } from './auth.js';
import { findMemberByUsername } from './members.js';
import { verifyPassword } from './password.js';

/**
 * Env logins first (bootstrap admins), then members who set their own password
 * through an invite link. Returns the canonical username, or null when invalid.
 */
export async function authenticateUser(username, password) {
  if (!username || !password) return null;

  if (validateCredentials(username, password)) return username;

  try {
    const member = await findMemberByUsername(username);
    if (!member?.password_hash) return null;
    const ok = await verifyPassword(password, member.password_hash);
    return ok ? String(member.username) : null;
  } catch (err) {
    console.error('Member login check failed:', err);
    return null;
  }
}
