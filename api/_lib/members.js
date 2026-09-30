import { defaultBoardNameForUsername } from './boardNameDefaults.js';
import { sendInviteEmail } from './email.js';
import {
  getTokenFromRequest,
  getAdminUsername,
  getAllowedUsers,
  isAdminUsername,
  verifySessionToken,
} from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import {
  createInviteToken,
  hashInviteToken,
  hashPassword,
  isStrongPassword,
} from './password.js';

const INVITE_DAYS = 7;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

const DEFAULT_ASSIGNEES = ['Gus', 'Joost', 'Pasha', 'Ksusha', 'Sasha', 'Misha', 'Tereza'];

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

function membersTableMissing(error) {
  const message = error?.message ?? '';
  return /taskboard_members|relation|does not exist/i.test(message);
}

function siteOrigin() {
  return (process.env.TASKBOARD_SITE_URL ?? '').replace(/\/$/, '');
}

function inviteUrlForToken(token) {
  const origin = siteOrigin();
  if (!origin) return `/invite?token=${encodeURIComponent(token)}`;
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
}

export async function requireAdmin(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const claims = await verifySessionToken(token);
    const username = typeof claims.username === 'string' ? claims.username : null;
    if (!isAdminUsername(username)) {
      res.status(403).json({ error: 'Forbidden' });
      return null;
    }
    return username;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeBoardName(value) {
  return String(value ?? '').trim();
}

function boardNameKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

function suggestedUsernameFromBoardName(boardName) {
  return normalizeBoardName(boardName).toLowerCase().replace(/\s+/g, '_');
}

function memberHasBoardName(members, boardName) {
  const key = boardNameKey(boardName);
  return members.some((member) => boardNameKey(member.board_name) === key);
}

function memberHasUsername(members, username) {
  const key = normalizeUsername(username);
  return members.some((member) => member.username === key);
}

async function fetchUserProfiles(supabase) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('username, email, board_name')
    .order('board_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

function mapMemberRow(row, envUsernames) {
  const username = String(row.username);
  const inviteExpires = row.invite_expires_at ? new Date(row.invite_expires_at) : null;
  const invitePending = Boolean(
    row.invite_token_hash && inviteExpires && inviteExpires.getTime() > Date.now()
  );
  return {
    username,
    email: row.email ?? null,
    board_name: row.board_name ?? defaultBoardNameForUsername(username),
    hasPassword: Boolean(row.password_hash),
    invitePending,
    inviteExpiresAt: row.invite_expires_at ?? null,
    source: envUsernames.has(username) ? 'both' : 'member',
    isAdmin: isAdminUsername(username),
  };
}

async function fetchDbMembers(supabase) {
  const { data, error } = await supabase
    .from('taskboard_members')
    .select(
      'username, email, board_name, password_hash, invite_token_hash, invite_expires_at, invite_sent_at'
    )
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listMemberUsernames() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  try {
    const rows = await fetchDbMembers(supabase);
    return rows.map((row) => String(row.username));
  } catch (error) {
    if (membersTableMissing(error)) return [];
    throw error;
  }
}

export async function findMemberByUsername(username) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('taskboard_members')
    .select('username, password_hash, email, board_name')
    .eq('username', normalizeUsername(username))
    .maybeSingle();

  if (error) {
    if (membersTableMissing(error)) return null;
    throw error;
  }
  return data ?? null;
}

async function upsertProfile(supabase, { username, email, board_name }) {
  await supabase.from('user_profiles').upsert(
    {
      username,
      email,
      board_name,
      notify_on_assign: true,
    },
    { onConflict: 'username' }
  );
}

export async function handleListMembers(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const envUsers = getAllowedUsers();
  const envUsernames = new Set(envUsers.map((user) => user.username));
  const supabase = getSupabaseAdmin();
  let dbRows = [];
  let membersReady = true;

  if (!supabase) {
    membersReady = false;
  } else {
    try {
      dbRows = await fetchDbMembers(supabase);
    } catch (error) {
      if (membersTableMissing(error)) {
        membersReady = false;
      } else {
        console.error('List members failed:', error);
        const detail = error?.message ? ` (${error.message})` : '';
        return res.status(500).json({ error: `Could not load members${detail}` });
      }
    }
  }

  const dbByUsername = new Map(dbRows.map((row) => [String(row.username), row]));
  const members = [];

  for (const user of envUsers) {
    const db = dbByUsername.get(user.username);
    if (db) {
      members.push(mapMemberRow(db, envUsernames));
    } else {
      members.push({
        username: user.username,
        email: null,
        board_name: defaultBoardNameForUsername(user.username),
        hasPassword: true,
        invitePending: false,
        inviteExpiresAt: null,
        source: 'env',
        isAdmin: isAdminUsername(user.username),
      });
    }
  }

  for (const row of dbRows) {
    if (!envUsernames.has(String(row.username))) {
      members.push(mapMemberRow(row, envUsernames));
    }
  }

  let profiles = [];
  if (supabase) {
    try {
      profiles = await fetchUserProfiles(supabase);
    } catch (error) {
      console.error('List members profile lookup failed:', error);
    }
  }

  for (const profile of profiles) {
    const username = normalizeUsername(profile.username);
    if (!username || isAdminUsername(username)) continue;
    if (memberHasUsername(members, username)) continue;
    const board_name =
      normalizeBoardName(profile.board_name) || defaultBoardNameForUsername(username);
    if (!board_name || memberHasBoardName(members, board_name)) continue;

    members.push({
      username,
      email: profile.email ?? null,
      board_name,
      hasPassword: false,
      invitePending: false,
      inviteExpiresAt: null,
      source: 'profile',
      isAdmin: false,
    });
  }

  for (const boardName of DEFAULT_ASSIGNEES) {
    if (memberHasBoardName(members, boardName)) continue;

    const profile = profiles.find((row) => boardNameKey(row.board_name) === boardNameKey(boardName));
    const username = profile
      ? normalizeUsername(profile.username)
      : suggestedUsernameFromBoardName(boardName);

    if (!USERNAME_PATTERN.test(username) || memberHasUsername(members, username)) continue;

    members.push({
      username,
      email: profile?.email ?? null,
      board_name: boardName,
      hasPassword: false,
      invitePending: false,
      inviteExpiresAt: null,
      source: profile ? 'profile' : 'roster',
      isAdmin: false,
    });
  }

  members.sort((a, b) => {
    const nameA = a.board_name || a.username;
    const nameB = b.board_name || b.username;
    return nameA.localeCompare(nameB);
  });

  return res.status(200).json({
    members,
    membersReady,
    adminUsername: getAdminUsername(),
  });
}

export async function handleCreateMember(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const body = readRequestBody(req);
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  const board_name = normalizeBoardName(body.board_name);

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error: 'Username must be 2–32 characters: lowercase letters, numbers, hyphen, or underscore.',
    });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!board_name) {
    return res.status(400).json({ error: 'Display name is required.' });
  }
  if (isAdminUsername(username)) {
    return res.status(400).json({ error: 'That username is reserved for the admin account.' });
  }

  const { data: existing, error: existingError } = await supabase
    .from('taskboard_members')
    .select('username, password_hash')
    .eq('username', username)
    .maybeSingle();

  if (existingError && !membersTableMissing(existingError)) {
    console.error('Create member lookup failed:', existingError);
    return res.status(500).json({ error: 'Could not create member', detail: existingError.message });
  }

  if (membersTableMissing(existingError)) {
    return res.status(503).json({
      error: 'Members table is not set up yet. Run supabase/migrations/017_taskboard_members.sql.',
    });
  }

  if (existing?.password_hash) {
    return res.status(409).json({ error: 'That username already has a password set.' });
  }

  const { data, error } = await supabase
    .from('taskboard_members')
    .upsert(
      {
        username,
        email,
        board_name,
      },
      { onConflict: 'username' }
    )
    .select('username, email, board_name, password_hash, invite_token_hash, invite_expires_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'That email or display name is already in use.' });
    }
    console.error('Create member failed:', error);
    return res.status(500).json({ error: 'Could not create member', detail: error.message });
  }

  await upsertProfile(supabase, { username, email, board_name });

  const envUsernames = new Set(getAllowedUsers().map((user) => user.username));
  return res.status(200).json({ member: mapMemberRow(data, envUsernames) });
}

function usernameFromDeleteRequest(req) {
  const body = readRequestBody(req);
  const fromBody = normalizeUsername(body.username);
  if (fromBody) return fromBody;

  if (req.query && typeof req.query.username === 'string') {
    return normalizeUsername(req.query.username);
  }

  const url = String(req.url ?? '');
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  return normalizeUsername(new URLSearchParams(q).get('username') ?? '');
}

export async function handleDeleteMember(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const username = usernameFromDeleteRequest(req);
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  if (isAdminUsername(username)) {
    return res.status(400).json({ error: 'The admin account cannot be removed.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const envUsernames = new Set(getAllowedUsers().map((user) => user.username));

  const { data: memberRow, error: memberLookupError } = await supabase
    .from('taskboard_members')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (memberLookupError && !membersTableMissing(memberLookupError)) {
    console.error('Delete member lookup failed:', memberLookupError);
    return res.status(500).json({ error: 'Could not remove member' });
  }

  const { data: profileRow, error: profileLookupError } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (profileLookupError) {
    console.error('Delete profile lookup failed:', profileLookupError);
    return res.status(500).json({ error: 'Could not remove profile' });
  }

  if (!memberRow && !profileRow) {
    if (envUsernames.has(username)) {
      return res.status(400).json({
        error: 'Server login accounts cannot be removed here. Change them in Vercel env vars.',
      });
    }
    return res.status(404).json({ error: 'No login or profile found for that username.' });
  }

  let removedMember = false;
  let removedProfile = false;

  if (memberRow) {
    const { error: deleteMemberError } = await supabase
      .from('taskboard_members')
      .delete()
      .eq('username', username);

    if (deleteMemberError) {
      console.error('Delete member failed:', deleteMemberError);
      return res.status(500).json({ error: 'Could not remove member login' });
    }
    removedMember = true;
  }

  if (profileRow) {
    const { error: deleteProfileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('username', username);

    if (deleteProfileError) {
      console.error('Delete profile failed:', deleteProfileError);
      return res.status(500).json({ error: 'Could not remove profile' });
    }
    removedProfile = true;
  }

  return res.status(200).json({
    ok: true,
    username,
    removedMember,
    removedProfile,
  });
}

async function issueInvite(supabase, username, invitedBy) {
  const token = createInviteToken();
  const invite_token_hash = hashInviteToken(token);
  const invite_expires_at = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const invite_sent_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('taskboard_members')
    .update({ invite_token_hash, invite_expires_at, invite_sent_at })
    .eq('username', username)
    .select('username, email, board_name')
    .single();

  if (error) throw error;

  const inviteUrl = inviteUrlForToken(token);
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    await sendInviteEmail({
      to: data.email,
      boardName: data.board_name,
      username: data.username,
      inviteUrl,
      invitedBy,
    });
  }

  return { inviteUrl, member: data, emailed: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) };
}

async function resolveMemberForInvite(supabase, username) {
  const uname = normalizeUsername(username);
  if (!uname) return null;

  const { data: existing, error: existingError } = await supabase
    .from('taskboard_members')
    .select('username, email, board_name, password_hash')
    .eq('username', uname)
    .maybeSingle();

  if (existingError && !membersTableMissing(existingError)) throw existingError;
  if (existing?.email) return existing;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('username, email, board_name')
    .eq('username', uname)
    .maybeSingle();

  if (profileError) throw profileError;

  const board_name =
    normalizeBoardName(profile?.board_name) || defaultBoardNameForUsername(uname);
  const email = normalizeEmail(profile?.email);

  if (!email || !board_name) return existing ?? null;

  const { data: upserted, error: upsertError } = await supabase
    .from('taskboard_members')
    .upsert({ username: uname, email, board_name }, { onConflict: 'username' })
    .select('username, email, board_name, password_hash')
    .single();

  if (upsertError) throw upsertError;
  await upsertProfile(supabase, { username: uname, email, board_name });
  return upserted;
}

export async function handleSendInvite(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const body = readRequestBody(req);
  const username = normalizeUsername(body.username);
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  let member;
  try {
    member = await resolveMemberForInvite(supabase, username);
  } catch (error) {
    console.error('Resolve member for invite failed:', error);
    return res.status(500).json({ error: 'Could not load member', detail: error.message });
  }

  if (!member?.email) {
    return res.status(400).json({
      error: 'Add an email for this person first, then send the invite.',
    });
  }
  if (member.password_hash) {
    return res.status(409).json({ error: 'This person already set their password.' });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('board_name')
    .eq('username', admin)
    .maybeSingle();

  try {
    const result = await issueInvite(
      supabase,
      username,
      profile?.board_name || defaultBoardNameForUsername(admin) || admin
    );
    return res.status(200).json({
      ok: true,
      inviteUrl: result.inviteUrl,
      emailed: result.emailed,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Send invite failed:', detail, err);
    return res.status(500).json({ error: 'Could not send invite', detail });
  }
}

export async function handleListAssignees(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const names = new Set(DEFAULT_ASSIGNEES);
  for (const user of getAllowedUsers()) {
    const mapped = defaultBoardNameForUsername(user.username);
    if (mapped) names.add(mapped);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const rows = await fetchDbMembers(supabase);
      for (const row of rows) {
        if (row.board_name) names.add(String(row.board_name));
      }
    } catch (error) {
      if (!membersTableMissing(error)) {
        console.error('List assignees failed:', error);
      }
    }

    try {
      const profiles = await fetchUserProfiles(supabase);
      for (const row of profiles) {
        if (row.board_name) names.add(String(row.board_name));
      }
    } catch (error) {
      console.error('List assignees profile lookup failed:', error);
    }
  }

  return res.status(200).json({
    assignees: [...names].sort((a, b) => a.localeCompare(b)),
  });
}

function getQueryToken(req) {
  if (req.query && typeof req.query.token === 'string') return req.query.token;
  const url = String(req.url ?? '');
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  return new URLSearchParams(q).get('token') ?? '';
}

export async function handleGetInvite(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getQueryToken(req);
  if (!token) {
    return res.status(400).json({ error: 'Missing invite token' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Server is not configured' });
  }

  const { data, error } = await supabase
    .from('taskboard_members')
    .select('username, board_name, password_hash, invite_expires_at')
    .eq('invite_token_hash', hashInviteToken(token))
    .maybeSingle();

  if (error) {
    if (membersTableMissing(error)) {
      return res.status(503).json({ error: 'Invites are not set up yet.' });
    }
    return res.status(500).json({ error: 'Could not load invite' });
  }

  if (!data) {
    return res.status(404).json({ error: 'This invite link is invalid or has already been used.' });
  }

  const expired =
    !data.invite_expires_at || new Date(data.invite_expires_at).getTime() < Date.now();

  return res.status(200).json({
    username: data.username,
    boardName: data.board_name,
    expired,
    alreadySet: Boolean(data.password_hash) && expired,
  });
}

export async function handleAcceptInvite(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = readRequestBody(req);
  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : password;

  if (!token) {
    return res.status(400).json({ error: 'Missing invite token' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Server is not configured' });
  }

  const { data, error } = await supabase
    .from('taskboard_members')
    .select('username, invite_expires_at')
    .eq('invite_token_hash', hashInviteToken(token))
    .maybeSingle();

  if (error || !data) {
    return res.status(404).json({ error: 'This invite link is invalid or has already been used.' });
  }

  if (!data.invite_expires_at || new Date(data.invite_expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'This invite link has expired. Ask an admin to send a new one.' });
  }

  const password_hash = await hashPassword(password);
  const { error: updateError } = await supabase
    .from('taskboard_members')
    .update({
      password_hash,
      invite_token_hash: null,
      invite_expires_at: null,
    })
    .eq('username', data.username);

  if (updateError) {
    console.error('Accept invite failed:', updateError);
    return res.status(500).json({ error: 'Could not save password' });
  }

  return res.status(200).json({ ok: true, username: data.username });
}
