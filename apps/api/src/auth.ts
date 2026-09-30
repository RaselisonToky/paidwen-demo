import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, workspaces } from './schema';

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keyLength: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }
  const derived = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface CurrentUser {
  id: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  plan: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: CurrentUser;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The web app authenticates the browser and forwards the user id in the x-user-id header.
 * The API is only reachable from inside the Docker network, so the header is trusted.
 */
export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
  const header = request.headers['x-user-id'];
  const userId = Array.isArray(header) ? header[0] : header;
  if (!userId || !UUID.test(userId)) {
    return reply.code(401).send({ error: 'unauthenticated' });
  }
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      confirmedAt: users.confirmedAt,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      plan: workspaces.plan,
    })
    .from(users)
    .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || !row.confirmedAt) {
    return reply.code(401).send({ error: 'unauthenticated' });
  }
  request.user = {
    id: row.id,
    email: row.email,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    plan: row.plan,
  };
  return undefined;
}
