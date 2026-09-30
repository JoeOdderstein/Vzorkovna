import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (!password || !stored || typeof stored !== 'string') return false;
  const [algo, salt, hash] = stored.split(':');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const derived = await scryptAsync(password, salt, 64);
  const a = Buffer.from(derived);
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createInviteToken() {
  return randomBytes(32).toString('base64url');
}

export function hashInviteToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function passwordsMatch(password, confirm) {
  return password === confirm;
}

export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}
