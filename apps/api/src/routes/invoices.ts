import type { FastifyPluginAsync } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { formatMoney, INVOICE_PAGE_SIZE, STATUS_LABELS, toCsv, type InvoicePageDto, type InvoiceSort, type NewInvoiceInput } from '@norbill/shared';
import { db } from '../db';
import { clients, invoices } from '../schema';
import { countInvoices, createInvoice, listInvoices, loadInvoice } from '../invoice-service';
import { queueEmail } from '../queue';

const invoiceParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const newInvoiceBody = {
  type: 'object',
  required: ['clientId', 'issuedAt', 'taxRate', 'lines'],
  properties: {
    clientId: { type: 'string', format: 'uuid' },
    issuedAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    taxRate: { type: 'number', minimum: 0, maximum: 100 },
    lines: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        required: ['description', 'quantity', 'unitPriceCents'],
        properties: {
          description: { type: 'string', minLength: 1, maxLength: 500 },
          quantity: { type: 'number', exclusiveMinimum: 0, maximum: 1000000 },
          unitPriceCents: { type: 'integer', minimum: 0, maximum: 1000000000 },
        },
      },
    },
  },
};

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { sort?: string; page?: string } }>('/invoices', async (request): Promise<InvoicePageDto> => {
    const workspaceId = request.user.workspaceId;
    const sort: InvoiceSort = request.query.sort === 'amount' ? 'amount' : 'newest';
    const total = await countInvoices(workspaceId);
    const pageCount = Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE));
    const page = Math.min(pageCount, Math.max(1, Number.parseInt(request.query.page ?? '1', 10) || 1));
    const items = await listInvoices(workspaceId, sort, INVOICE_PAGE_SIZE, (page - 1) * INVOICE_PAGE_SIZE);
    return { items, page, pageCount, total };
  });

  app.get('/invoices/export', async (request, reply) => {
    const rows = await listInvoices(request.user.workspaceId, 'oldest');
    const csv = toCsv([
      ['number', 'client', 'date', 'total', 'status'],
      ...rows.map((row) => [row.number, row.clientName, row.issuedAt, (row.totalCents / 100).toFixed(2), STATUS_LABELS[row.status]]),
    ]);
    return reply.header('content-type', 'text/csv; charset=utf-8').send(csv);
  });

  app.post<{ Body: NewInvoiceInput }>('/invoices', { schema: { body: newInvoiceBody } }, async (request, reply) => {
    const workspaceId = request.user.workspaceId;
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, request.body.clientId), eq(clients.workspaceId, workspaceId)))
      .limit(1);
    if (!client) {
      return reply.code(400).send({ error: 'unknown-client' });
    }
    const input: NewInvoiceInput = {
      ...request.body,
      lines: request.body.lines.map((line) => ({ ...line, description: line.description.trim() })),
    };
    const invoiceId = await db.transaction((tx) => createInvoice(tx, workspaceId, input));
    const invoice = await loadInvoice(workspaceId, invoiceId);
    return reply.code(201).send(invoice);
  });

  app.get<{ Params: { id: string } }>('/invoices/:id', { schema: { params: invoiceParams } }, async (request, reply) => {
    const invoice = await loadInvoice(request.user.workspaceId, request.params.id);
    if (!invoice) {
      return reply.code(404).send({ error: 'not-found' });
    }
    return invoice;
  });

  app.post<{ Params: { id: string } }>('/invoices/:id/send', { schema: { params: invoiceParams } }, async (request, reply) => {
    const invoice = await loadInvoice(request.user.workspaceId, request.params.id);
    if (!invoice) {
      return reply.code(404).send({ error: 'not-found' });
    }
    if (invoice.status === 'sent') {
      return invoice;
    }
    await db.update(invoices).set({ status: 'sent', sentAt: new Date() }).where(eq(invoices.id, invoice.id));
    await queueEmail({
      to: invoice.clientEmail,
      subject: `Invoice ${invoice.number} from ${request.user.workspaceName}`,
      text: [
        `Hello ${invoice.clientName},`,
        '',
        `${request.user.workspaceName} sent you invoice ${invoice.number} dated ${invoice.issuedAt}.`,
        '',
        ...invoice.lines.map((line) => `- ${line.description}: ${line.quantity} x ${formatMoney(line.unitPriceCents)} = ${formatMoney(line.amountCents)}`),
        '',
        `Subtotal: ${formatMoney(invoice.subtotalCents)}`,
        `Tax (${invoice.taxRate}%): ${formatMoney(invoice.taxCents)}`,
        `Total: ${formatMoney(invoice.totalCents)}`,
      ].join('\n'),
    });
    return { ...invoice, status: 'sent' };
  });
};
