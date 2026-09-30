import type { FastifyPluginAsync } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import type { ClientDto } from '@norbill/shared';
import { db } from '../db';
import { clients } from '../schema';

interface ClientBody {
  name: string;
  email: string;
}

function toDto(row: typeof clients.$inferSelect): ClientDto {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt.toISOString() };
}

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.get('/clients', async (request) => {
    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.workspaceId, request.user.workspaceId))
      .orderBy(asc(clients.name));
    return rows.map(toDto);
  });

  app.post<{ Body: ClientBody }>(
    '/clients',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            email: { type: 'string', minLength: 3, maxLength: 320 },
          },
        },
      },
    },
    async (request, reply) => {
      const [row] = await db
        .insert(clients)
        .values({
          workspaceId: request.user.workspaceId,
          name: request.body.name.trim(),
          email: request.body.email.trim().toLowerCase(),
        })
        .returning();
      return reply.code(201).send(toDto(row));
    },
  );
};
