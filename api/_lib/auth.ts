import { SignJWT, jwtVerify } from 'jose';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'taskboard_session';
const SESSION_DAYS = 7;

function getJwtSecret() {
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'local-dev-jwt-secret-min-32-chars!!' : undefined);
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken() {
  const sub = process.env.TASKBOARD_USER_ID ?? '00000000-0000-0000-0000-000000000001';

  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    audience: 'authenticated',
  });
  return payload;
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res: VercelResponse) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
  );
}

export function getTokenFromRequest(req: VercelRequest): string | null {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export function validateCredentials(username: string, password: string) {
  const expectedUser = process.env.TASKBOARD_USERNAME ?? 'vzorkovna';
  const expectedPass =
    process.env.TASKBOARD_PASSWORD ??
    (process.env.NODE_ENV !== 'production' ? 'joost' : undefined);

  if (!expectedPass) return false;
  return username === expectedUser && password === expectedPass;
}

export function getAuthConfigError(): string | null {
  if (!process.env.TASKBOARD_PASSWORD && process.env.NODE_ENV === 'production') {
    return 'TASKBOARD_PASSWORD is not configured on the server.';
  }
  if (!process.env.SUPABASE_JWT_SECRET && process.env.NODE_ENV === 'production') {
    return 'SUPABASE_JWT_SECRET is not configured on the server.';
  }
  return null;
}
