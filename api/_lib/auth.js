import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'taskboard_session';
const SESSION_DAYS = 7;

function getJwtSecret() {
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'local-dev-jwt-secret-min-32-chars!!' : undefined);
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not configured');
  return secret;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', getJwtSecret()).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export async function createSessionToken() {
  const sub = process.env.TASKBOARD_USER_ID ?? '00000000-0000-0000-0000-000000000001';
  const now = Math.floor(Date.now() / 1000);

  return signJwt({
    role: 'authenticated',
    sub,
    aud: 'authenticated',
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function verifySessionToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = createHmac('sha256', getJwtSecret()).update(data).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid token signature');
  }

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  if (claims.aud !== 'authenticated') throw new Error('Invalid token audience');
  if (claims.exp != null && claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return claims;
}

export function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
  );
}

export function getTokenFromRequest(req) {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export function validateCredentials(username, password) {
  const expectedUser = process.env.TASKBOARD_USERNAME ?? 'vzorkovna';
  const expectedPass =
    process.env.TASKBOARD_PASSWORD ??
    (process.env.NODE_ENV !== 'production' ? 'joost' : undefined);

  if (!expectedPass) return false;
  return username === expectedUser && password === expectedPass;
}

export function getAuthConfigError() {
  if (!process.env.TASKBOARD_PASSWORD && process.env.NODE_ENV === 'production') {
    return 'TASKBOARD_PASSWORD is not configured on the server.';
  }
  if (!process.env.SUPABASE_JWT_SECRET && process.env.NODE_ENV === 'production') {
    return 'SUPABASE_JWT_SECRET is not configured on the server.';
  }
  return null;
}
