import Fastify, { type FastifyInstance } from 'fastify';
import { requireUser, type CurrentUser } from './auth';
import { pool } from './db';
import { authRoutes } from './routes/auth';
import { clientRoutes } from './routes/clients';
import { invoiceRoutes } from './routes/invoices';
import { webhookRoutes, workspaceRoutes } from './routes/workspace';

interface KnownError {
  validation?: unknown;
  code?: string;
  statusCode?: number;
  message: string;
}

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });

  // The preHandler hook of the protected routes fills this in.
  app.decorateRequest('user', null as unknown as CurrentUser);

  app.get('/health', async (_request, reply) => {
    try {
      await pool.query('select 1');
    } catch (error) {
      app.log.error({ err: error }, 'Database health check failed');
      return reply.code(503).send({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok' };
  });

  app.register(authRoutes);
  app.register(webhookRoutes);
  app.register(async (protectedScope) => {
    protectedScope.addHook('preHandler', requireUser);
    await protectedScope.register(workspaceRoutes);
    await protectedScope.register(clientRoutes);
    await protectedScope.register(invoiceRoutes);
  });

  app.setErrorHandler((error: KnownError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'validation', message: error.message });
    }
    if (error.code === '23505') {
      return reply.code(409).send({ error: 'conflict' });
    }
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'Unhandled error');
    }
    return reply.code(status).send({ error: status >= 500 ? 'internal' : 'request', message: error.message });
  });

  return app;
}
