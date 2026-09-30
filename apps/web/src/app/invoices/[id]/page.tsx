import { formatMoney, STATUS_LABELS, type InvoiceDto } from '@norbill/shared';
import { load, requireUserId, single, type SearchParams } from '@/lib/api';

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const invoice = await load<InvoiceDto>(`/invoices/${encodeURIComponent(id)}`, userId);
  const query = await searchParams;
  return (
    <>
      <div className="page-header">
        <h1>Invoice {invoice.number}</h1>
        <span className={`badge ${invoice.status}`} data-testid="invoice-status">
          {STATUS_LABELS[invoice.status]}
        </span>
      </div>
      {single(query.created) ? (
        <p className="alert success" role="status">
          Invoice created.
        </p>
      ) : null}
      {single(query.sent) ? (
        <p className="alert success" role="status">
          Invoice marked as sent. The client receives it by email.
        </p>
      ) : null}
      {single(query.error) ? (
        <p className="alert error" role="alert">
          The invoice could not be updated.
        </p>
      ) : null}
      <dl className="details">
        <dt>Client</dt>
        <dd>{invoice.clientName}</dd>
        <dt>Date</dt>
        <dd>{invoice.issuedAt}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Quantity</th>
            <th className="num">Unit price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td className="num">{line.quantity}</td>
              <td className="num">{formatMoney(line.unitPriceCents)}</td>
              <td className="num">{formatMoney(line.amountCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3} className="num">
              Subtotal
            </th>
            <td className="num">{formatMoney(invoice.subtotalCents)}</td>
          </tr>
          <tr>
            <th colSpan={3} className="num">
              Tax ({invoice.taxRate}%)
            </th>
            <td className="num">{formatMoney(invoice.taxCents)}</td>
          </tr>
          <tr>
            <th colSpan={3} className="num">
              Total
            </th>
            <td className="num">
              <strong>{formatMoney(invoice.totalCents)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      {invoice.notes ? (
        <>
          <h2>Notes</h2>
          <p className="notes">{invoice.notes}</p>
        </>
      ) : null}
      <div className="spacer" />
      <div className="actions">
        {invoice.status === 'draft' ? (
          <form action={`/api/invoices/${invoice.id}/send`} method="post">
            <button type="submit" className="button">
              Mark as sent
            </button>
          </form>
        ) : null}
        <a href="/invoices" className="button secondary">
          Back to invoices
        </a>
      </div>
    </>
  );
}
