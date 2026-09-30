import { toCents, type NewInvoiceInput, type NewInvoiceLine } from '@norbill/shared';
import { api, field, seeOther } from '@/lib/api';
import { currentUserId } from '@/lib/session';

function text(value: FormDataEntryValue | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Turns the three form lines into invoice lines. Lines without a description are ignored. */
function parseLines(form: FormData): NewInvoiceLine[] | null {
  const descriptions = form.getAll('description');
  const quantities = form.getAll('quantity');
  const prices = form.getAll('unitPrice');
  const lines: NewInvoiceLine[] = [];
  for (let index = 0; index < descriptions.length; index += 1) {
    const description = text(descriptions[index]);
    if (!description) {
      continue;
    }
    const quantity = Number(text(quantities[index]) || '1');
    const unitPrice = Number(text(prices[index]) || '0');
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return null;
    }
    lines.push({ description, quantity, unitPriceCents: toCents(unitPrice) });
  }
  return lines;
}

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) {
    return seeOther('/login');
  }
  const form = await request.formData();
  const clientId = field(form, 'clientId');
  const issuedAt = field(form, 'issuedAt') || new Date().toISOString().slice(0, 10);
  const taxRate = Number(field(form, 'taxRate') || '0');
  const lines = parseLines(form);
  if (!clientId || !lines || lines.length === 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return seeOther('/invoices/new?error=invalid');
  }
  const body: NewInvoiceInput = { clientId, issuedAt, taxRate, lines };
  const response = await api<{ id?: string; error?: string }>('/invoices', { method: 'POST', body, userId });
  if (response.status === 401) {
    return seeOther('/login');
  }
  if (response.status !== 201 || !response.data?.id) {
    const reason = response.data?.error === 'unknown-client' ? 'unknown-client' : 'invalid';
    return seeOther(`/invoices/new?error=${reason}`);
  }
  return seeOther(`/invoices/${response.data.id}?created=1`);
}
