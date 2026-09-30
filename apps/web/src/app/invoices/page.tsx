import { formatMoney, STATUS_LABELS, type InvoiceSummaryDto } from '@norbill/shared';
import { load, requireUserId } from '@/lib/api';

export default async function InvoicesPage() {
  const userId = await requireUserId();
  const invoiceList = await load<InvoiceSummaryDto[]>('/invoices', userId);
  return (
    <>
      <div className="page-header">
        <h1>Invoices</h1>
        <div className="actions">
          <form action="/api/invoices/export" method="get">
            <button type="submit" className="button secondary">
              Export CSV
            </button>
          </form>
          <a href="/invoices/new" className="button">
            New invoice
          </a>
        </div>
      </div>
      {invoiceList.length === 0 ? (
        <p className="empty">No invoices yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Date</th>
              <th className="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoiceList.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <a href={`/invoices/${invoice.id}`}>{invoice.number}</a>
                </td>
                <td>{invoice.clientName}</td>
                <td>{invoice.issuedAt}</td>
                <td className="num">{formatMoney(invoice.totalCents)}</td>
                <td>
                  <span className={`badge ${invoice.status}`}>{STATUS_LABELS[invoice.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
