import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, workspaces } from '../schema';
import { hashPassword, randomToken, verifyPassword } from '../auth';
import { queueEmail } from '../queue';

const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignupBody {
  companyName: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ConfirmBody {
  token: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: SignupBody }>(
    '/auth/signup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['companyName', 'email', 'password'],
          properties: {
            companyName: { type: 'string', minLength: 1, maxLength: 200 },
            email: { type: 'string', minLength: 3, maxLength: 320 },
            password: { type: 'string', minLength: 8, maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const companyName = request.body.companyName.trim();
      if (!EMAIL.test(email) || companyName.length === 0) {
        return reply.code(400).send({ error: 'invalid' });
      }
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        return reply.code(409).send({ error: 'email-taken' });
      }
      const token = randomToken();
      const passwordHash = await hashPassword(request.body.password);
      const userId = await db.transaction(async (tx) => {
        const [workspace] = await tx.insert(workspaces).values({ name: companyName }).returning({ id: workspaces.id });
        const [user] = await tx
          .insert(users)
          .values({ workspaceId: workspace.id, email, passwordHash, confirmToken: token })
          .returning({ id: users.id });
        return user.id;
      });
      await queueEmail({
        to: email,
        subject: 'Confirm your Norbill account',
        text: [
          'Hello,',
          '',
          `Thanks for creating a Norbill account for ${companyName}.`,
          'Open this link to confirm your email address:',
          '',
          `${APP_URL}/confirm?token=${token}`,
          '',
          'If you did not create this account, you can ignore this email.',
        ].join('\n'),
      });
      return reply.code(201).send({ userId });
    },
  );

  app.post<{ Body: ConfirmBody }>(
    '/auth/confirm',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    async (request, reply) => {
      const [user] = await db
        .select({ id: users.id, confirmedAt: users.confirmedAt })
        .from(users)
        .where(eq(users.confirmToken, request.body.token))
        .limit(1);
      if (!user) {
        return reply.code(404).send({ error: 'invalid-token' });
      }
      if (!user.confirmedAt) {
        await db.update(users).set({ confirmedAt: new Date() }).where(eq(users.id, user.id));
      }
      return { userId: user.id };
    },
  );

  app.post<{ Body: LoginBody }>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', minLength: 1, maxLength: 320 },
            password: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const [user] = await db
        .select({ id: users.id, passwordHash: users.passwordHash, confirmedAt: users.confirmedAt })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user || !(await verifyPassword(request.body.password, user.passwordHash))) {
        return reply.code(401).send({ error: 'invalid-credentials' });
      }
      if (!user.confirmedAt) {
        return reply.code(403).send({ error: 'unconfirmed' });
      }
      return { userId: user.id };
    },
  );
};
