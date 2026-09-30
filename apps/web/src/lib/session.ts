import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'norbill_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  return process.env.SESSION_SECRET || 'development-only-session-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Returns a Set-Cookie header value that logs the user in. */
export function createSessionCookie(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({ userId, exp })).toString('base64url');
  return `${COOKIE_NAME}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

/** Returns a Set-Cookie header value that logs the user out. */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSession(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const [payload, signature] = value.split('.');
  if (!payload || !signature) {
    return null;
  }
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string; exp?: number };
    if (typeof data.userId !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now() / 1000) {
      return null;
    }
    return data.userId;
  } catch {
    return null;
  }
}

export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  return readSession(store.get(COOKIE_NAME)?.value);
}
