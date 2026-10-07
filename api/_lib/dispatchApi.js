import authAssignees from './handlers/auth-assignees.js';
import authInvite from './handlers/auth-invite.js';
import authLogin from './handlers/auth-login.js';
import authLogout from './handlers/auth-logout.js';
import authMembers from './handlers/auth-members.js';
import authMembersInvite from './handlers/auth-members-invite.js';
import authNotifyRecipients from './handlers/auth-notify-recipients.js';
import authSession from './handlers/auth-session.js';
import authUsernames from './handlers/auth-usernames.js';
import installationsNotifyBug from './handlers/installations-notify-bug.js';
import tasksNotifyAssignment from './handlers/tasks-notify-assignment.js';
import tasksNotifyComment from './handlers/tasks-notify-comment.js';
import translate from './handlers/translate.js';

const ROUTES = {
  'auth/login': authLogin,
  'auth/logout': authLogout,
  'auth/session': authSession,
  'auth/members': authMembers,
  'auth/members-invite': authMembersInvite,
  'auth/invite': authInvite,
  'auth/assignees': authAssignees,
  'auth/usernames': authUsernames,
  'auth/notify-recipients': authNotifyRecipients,
  'tasks/notify-assignment': tasksNotifyAssignment,
  'tasks/notify-comment': tasksNotifyComment,
  'installations/notify-bug': installationsNotifyBug,
  translate: translate,
};

export function normalizeApiPath(req) {
  // Vercel rewrite to /api preserves the original URL in req.url (preferred).
  const rawUrl = typeof req.url === 'string' ? req.url : '';
  const pathname = rawUrl.split('?')[0] ?? '';
  const fromUrl = pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  if (fromUrl) return fromUrl;

  const fromQuery = req.query?.path;
  if (Array.isArray(fromQuery)) {
    return fromQuery.filter(Boolean).join('/');
  }
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.replace(/^\/+/, '');
  }

  return '';
}

export async function dispatchApi(req, res) {
  const path = normalizeApiPath(req);
  const handler = ROUTES[path];

  if (!handler) {
    return res.status(404).json({ error: 'Not found' });
  }

  return handler(req, res);
}
