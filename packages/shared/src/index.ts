export type Plan = 'free' | 'pro';
export type InvoiceStatus = 'draft' | 'sent';

export interface UserDto {
  id: string;
  email: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  plan: Plan;
}

export interface MeDto {
  user: UserDto;
  workspace: WorkspaceDto;
}

export interface DashboardDto {
  clients: number;
  invoices: number;
  sentTotalCents: number;
}

export interface ClientDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface InvoiceLineDto {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}

export interface InvoiceSummaryDto {
  id: string;
  number: string;
  clientName: string;
  issuedAt: string;
  totalCents: number;
  status: InvoiceStatus;
}

export type InvoiceSort = 'newest' | 'amount';

export const INVOICE_PAGE_SIZE = 5;

export interface InvoicePageDto {
  items: InvoiceSummaryDto[];
  page: number;
  pageCount: number;
  total: number;
}

export interface InvoiceDto extends InvoiceSummaryDto {
  clientEmail: string;
  taxRate: number;
  subtotalCents: number;
  taxCents: number;
  lines: InvoiceLineDto[];
  notes: string | null;
}

export interface NewInvoiceLine {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface NewInvoiceInput {
  clientId: string;
  issuedAt: string;
  taxRate: number;
  lines: NewInvoiceLine[];
  notes?: string;
}

export interface BillingDto {
  plan: Plan;
  paymentsConfigured: boolean;
  workspaceId: string;
}

export const PLAN_LABELS: Record<Plan, string> = { free: 'Free', pro: 'Pro' };
export const STATUS_LABELS: Record<InvoiceStatus, string> = { draft: 'Draft', sent: 'Sent' };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(cents: number): string {
  return money.format(cents / 100);
}

export function toCents(amount: number | string): number {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return Math.round(value * 100);
}

export interface InvoiceTotals {
  amounts: number[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export function computeTotals(lines: NewInvoiceLine[], taxRate: number): InvoiceTotals {
  const amounts = lines.map((line) => Math.round(line.quantity * line.unitPriceCents));
  const subtotalCents = amounts.reduce((sum, amount) => sum + amount, 0);
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  return { amounts, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
