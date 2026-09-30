import { and, asc, count, desc, eq } from 'drizzle-orm';
import { computeTotals, type InvoiceDto, type InvoiceStatus, type InvoiceSummaryDto, type NewInvoiceInput } from '@norbill/shared';
import { db, type DbExecutor } from './db';
import { clients, invoiceLines, invoices } from './schema';

/** Creates an invoice with its lines. The caller checks that the client belongs to the workspace. */
export async function createInvoice(executor: DbExecutor, workspaceId: string, input: NewInvoiceInput): Promise<string> {
  const totals = computeTotals(input.lines, input.taxRate);
  const [existing] = await executor.select({ count: count() }).from(invoices).where(eq(invoices.workspaceId, workspaceId));
  const number = `INV-${String((existing?.count ?? 0) + 1).padStart(4, '0')}`;
  const [invoice] = await executor
    .insert(invoices)
    .values({
      workspaceId,
      clientId: input.clientId,
      number,
      issuedAt: input.issuedAt,
      taxRate: input.taxRate.toFixed(2),
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
    })
    .returning({ id: invoices.id });
  await executor.insert(invoiceLines).values(
    input.lines.map((line, index) => ({
      invoiceId: invoice.id,
      position: index + 1,
      description: line.description,
      quantity: line.quantity.toFixed(2),
      unitPriceCents: line.unitPriceCents,
      amountCents: totals.amounts[index],
    })),
  );
  return invoice.id;
}

export type InvoiceOrder = 'newest' | 'oldest' | 'amount';

function ordering(order: InvoiceOrder) {
  if (order === 'amount') {
    return [desc(invoices.totalCents), desc(invoices.number)];
  }
  return order === 'newest' ? [desc(invoices.number)] : [asc(invoices.number)];
}

export async function countInvoices(workspaceId: string): Promise<number> {
  const [row] = await db.select({ count: count() }).from(invoices).where(eq(invoices.workspaceId, workspaceId));
  return row?.count ?? 0;
}

export async function listInvoices(workspaceId: string, order: InvoiceOrder, limit = 10_000, offset = 0): Promise<InvoiceSummaryDto[]> {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: clients.name,
      issuedAt: invoices.issuedAt,
      totalCents: invoices.totalCents,
      status: invoices.status,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.workspaceId, workspaceId))
    .orderBy(...ordering(order))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => ({ ...row, status: row.status as InvoiceStatus }));
}

export async function loadInvoice(workspaceId: string, invoiceId: string): Promise<InvoiceDto | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: clients.name,
      clientEmail: clients.email,
      issuedAt: invoices.issuedAt,
      status: invoices.status,
      taxRate: invoices.taxRate,
      subtotalCents: invoices.subtotalCents,
      taxCents: invoices.taxCents,
      totalCents: invoices.totalCents,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  if (!row) {
    return null;
  }
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, row.id))
    .orderBy(asc(invoiceLines.position));
  return {
    ...row,
    status: row.status as InvoiceStatus,
    taxRate: Number(row.taxRate),
    lines: lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
      unitPriceCents: line.unitPriceCents,
      amountCents: line.amountCents,
    })),
  };
}
