import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadEnv } from 'vite';
import {
  clearSessionCookie,
  createSessionToken,
  getAuthConfigError,
  getTokenFromRequest,
  setSessionCookie,
  getAdminUsername,
  getTaskboardUsernames,
  isAdminUsername,
  validateCredentials,
  verifySessionToken,
} from './api/_lib/auth.js';
import { handleNotifyAssignment } from './api/_lib/notifyAssignment.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function syncDevEnv() {
  const env = loadEnv('development', process.cwd(), '');
  Object.assign(process.env, env);
}

/** Local dev API for taskboard auth (production uses Vercel serverless). */
export function taskboardDevApi(): Plugin {
  return {
    name: 'taskboard-dev-api',
    configureServer(server) {
      syncDevEnv();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/api/')) return next();

        syncDevEnv();

        try {
          if (url === '/api/tasks/notify-assignment' && req.method === 'POST') {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            return handleNotifyAssignment(
              { ...req, method: req.method, headers: req.headers, body } as never,
              {
                status: (code: number) => {
                  res.statusCode = code;
                  return {
                    json: (payload: unknown) => sendJson(res, code, payload),
                  };
                },
              } as never
            );
          }

          if (!url.startsWith('/api/auth')) {
            return sendJson(res, 404, { error: 'Not found' });
          }

          if (url === '/api/auth/login' && req.method === 'POST') {
            const configError = getAuthConfigError();
            if (configError) {
              return sendJson(res, 503, { error: configError });
            }

            const raw = await readBody(req);
            const { username, password } = JSON.parse(raw || '{}');
            if (!validateCredentials(String(username ?? ''), String(password ?? ''))) {
              return sendJson(res, 401, { error: 'Incorrect username or password' });
            }
            const normalizedUsername = String(username ?? '');
            const token = await createSessionToken(normalizedUsername);
            setSessionCookie(res as never, token);
            return sendJson(res, 200, {
              ok: true,
              accessToken: token,
              username: normalizedUsername,
              isAdmin: isAdminUsername(normalizedUsername),
            });
          }

          if (url === '/api/auth/logout' && req.method === 'POST') {
            clearSessionCookie(res as never);
            return sendJson(res, 200, { ok: true });
          }

          if (url === '/api/auth/session' && req.method === 'GET') {
            const token = getTokenFromRequest({ headers: { cookie: req.headers.cookie } } as never);
            if (!token) return sendJson(res, 401, { authenticated: false });
            const claims = await verifySessionToken(token);
            const username = typeof claims.username === 'string' ? claims.username : null;
            return sendJson(res, 200, {
              authenticated: true,
              accessToken: token,
              username,
              isAdmin: isAdminUsername(username),
            });
          }

          if (url === '/api/auth/usernames' && req.method === 'GET') {
            const token = getTokenFromRequest({ headers: { cookie: req.headers.cookie } } as never);
            if (!token) return sendJson(res, 401, { error: 'Unauthorized' });
            try {
              const claims = await verifySessionToken(token);
              const username = typeof claims.username === 'string' ? claims.username : null;
              if (!isAdminUsername(username)) {
                return sendJson(res, 403, { error: 'Forbidden' });
              }
              const adminUsername = getAdminUsername();
              const usernames = getTaskboardUsernames().filter((name) => name !== adminUsername);
              return sendJson(res, 200, { usernames, adminUsername });
            } catch {
              return sendJson(res, 401, { error: 'Unauthorized' });
            }
          }

          sendJson(res, 404, { error: 'Not found' });
        } catch {
          sendJson(res, 500, { error: 'Server error' });
        }
      });
    },
  };
}
