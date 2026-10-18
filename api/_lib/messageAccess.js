import {
  getAdminUsername,
  getTokenFromRequest,
  getTaskboardUsernames,
  isAdminUsername,
  verifySessionToken,
} from './auth.js';
import { findMemberByUsername } from './members.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

function readRequestBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body;
}

function messageAccessTableMissing(error) {
  const message = error?.message ?? '';
  return /message_access_members|relation|does not exist/i.test(message);
}

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export async function requireAuthenticated(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const claims = await verifySessionToken(token);
    const username = typeof claims.username === 'string' ? claims.username : null;
    if (!username) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    return { username, isAdmin: isAdminUsername(username) };
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

export async function userCanAccessMessages(username, isAdmin = false) {
  if (isAdmin || isAdminUsername(username)) return true;
  if (!username) return false;

  const supabase = getSupabaseAdmin();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from('message_access_members')
    .select('username')
    .eq('username', normalizeUsername(username))
    .maybeSingle();

  if (error) {
    if (messageAccessTableMissing(error)) return true;
    console.error('Message access lookup failed:', error);
    return false;
  }

  return Boolean(data);
}

export async function requireMessageAreaAccess(req, res) {
  const auth = await requireAuthenticated(req, res);
  if (!auth) return null;

  const allowed = await userCanAccessMessages(auth.username, auth.isAdmin);
  if (!allowed) {
    res.status(403).json({ error: 'You do not have access to Messages.' });
    return null;
  }

  return auth;
}

async function isUsernameGrantable(username) {
  if (!USERNAME_PATTERN.test(username)) return false;
  if (username === getAdminUsername()) return false;
  if (getTaskboardUsernames().includes(username)) return true;
  const member = await findMemberByUsername(username);
  return Boolean(member);
}

async function fetchAccessRows() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { rows: [], ready: false };

  const { data, error } = await supabase
    .from('message_access_members')
    .select('username, granted_at, granted_by')
    .order('granted_at', { ascending: true });

  if (error) {
    if (messageAccessTableMissing(error)) return { rows: [], ready: false };
    throw error;
  }

  return { rows: data ?? [], ready: true };
}

async function boardNameForUsername(username) {
  const member = await findMemberByUsername(username);
  if (member?.board_name) return String(member.board_name);
  return username;
}

export async function handleGetMessageAccess(req, res) {
  const auth = await requireAuthenticated(req, res);
  if (!auth) return;

  if (!auth.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { rows, ready } = await fetchAccessRows();
    const members = await Promise.all(
      rows.map(async (row) => ({
        username: String(row.username),
        board_name: await boardNameForUsername(String(row.username)),
        granted_at: row.granted_at ?? null,
        granted_by: row.granted_by ?? null,
      })),
    );

    return res.status(200).json({ members, messageAccessReady: ready });
  } catch (err) {
    console.error('List message access failed:', err);
    return res.status(500).json({ error: 'Could not load message access list.' });
  }
}

export async function handleGrantMessageAccess(req, res) {
  const auth = await requireAuthenticated(req, res);
  if (!auth || !auth.isAdmin) {
    if (auth) res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = readRequestBody(req);
  const username = normalizeUsername(body.username);
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  if (isAdminUsername(username)) {
    return res.status(400).json({ error: 'Admin always has Messages access.' });
  }

  if (!(await isUsernameGrantable(username))) {
    return res.status(400).json({ error: 'Unknown user — add them as a taskboard member first.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured.' });
  }

  const { data, error } = await supabase
    .from('message_access_members')
    .upsert({ username, granted_by: auth.username }, { onConflict: 'username' })
    .select('username, granted_at, granted_by')
    .single();

  if (error) {
    if (messageAccessTableMissing(error)) {
      return res.status(503).json({
        error: 'Message access is not set up. Run migration 041_message_access_members.sql.',
      });
    }
    console.error('Grant message access failed:', error);
    return res.status(500).json({ error: 'Could not grant message access.' });
  }

  return res.status(200).json({
    member: {
      username: data.username,
      board_name: await boardNameForUsername(data.username),
      granted_at: data.granted_at,
      granted_by: data.granted_by,
    },
  });
}

export async function handleRevokeMessageAccess(req, res) {
  const auth = await requireAuthenticated(req, res);
  if (!auth || !auth.isAdmin) {
    if (auth) res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = readRequestBody(req);
  const username = normalizeUsername(body.username);
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured.' });
  }

  const { error } = await supabase.from('message_access_members').delete().eq('username', username);

  if (error) {
    if (messageAccessTableMissing(error)) {
      return res.status(503).json({
        error: 'Message access is not set up. Run migration 041_message_access_members.sql.',
      });
    }
    console.error('Revoke message access failed:', error);
    return res.status(500).json({ error: 'Could not revoke message access.' });
  }

  return res.status(200).json({ ok: true });
}
