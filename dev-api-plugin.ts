import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadEnv } from 'vite';
import {
  clearSessionCookie,
  createSessionToken,
  getAuthConfigError,
  getTokenFromRequest,
  setSessionCookie,
  validateCredentials,
  verifySessionToken,
} from './api/_lib/auth';

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

/** Local dev API for taskboard auth (production uses Vercel serverless). */
export function taskboardDevApi(): Plugin {
  return {
    name: 'taskboard-dev-api',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '');
      Object.assign(process.env, env);

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/api/auth')) return next();

        try {
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
            const token = await createSessionToken();
            setSessionCookie(res as never, token);
            return sendJson(res, 200, { ok: true, accessToken: token });
          }

          if (url === '/api/auth/logout' && req.method === 'POST') {
            clearSessionCookie(res as never);
            return sendJson(res, 200, { ok: true });
          }

          if (url === '/api/auth/session' && req.method === 'GET') {
            const token = getTokenFromRequest({ headers: { cookie: req.headers.cookie } } as never);
            if (!token) return sendJson(res, 401, { authenticated: false });
            await verifySessionToken(token);
            return sendJson(res, 200, { authenticated: true, accessToken: token });
          }

          sendJson(res, 404, { error: 'Not found' });
        } catch {
          sendJson(res, 500, { error: 'Server error' });
        }
      });
    },
  };
}
