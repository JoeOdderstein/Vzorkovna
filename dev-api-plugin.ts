import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadEnv } from 'vite';
import { dispatchApi } from './api/_lib/dispatchApi.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
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

function pathFromUrl(url: string) {
  const pathname = url.split('?')[0] ?? '';
  return pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
}

/** Local dev API — same routing as Vercel `api/index.js` + /api/:path* rewrite. */
export function taskboardDevApi(): Plugin {
  return {
    name: 'taskboard-dev-api',
    configureServer(server) {
      syncDevEnv();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/') && url !== '/api') return next();

        syncDevEnv();

        try {
          const raw =
            req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req);
          let body: unknown = undefined;
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = raw;
            }
          }

          const apiPath = pathFromUrl(url);

          await dispatchApi(
            {
              ...req,
              method: req.method,
              url,
              headers: req.headers,
              query: { path: apiPath.split('/').filter(Boolean) },
              body,
            } as never,
            {
              status: (code: number) => ({
                json: (payload: unknown) => sendJson(res, code, payload),
              }),
            } as never,
          );
        } catch {
          sendJson(res, 500, { error: 'Server error' });
        }
      });
    },
  };
}
