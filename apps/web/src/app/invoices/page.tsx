import { formatMoney, STATUS_LABELS, type InvoicePageDto, type InvoiceSort } from '@norbill/shared';
import { load, requireUserId, single, type SearchParams } from '@/lib/api';

const SORTS: Array<{ value: InvoiceSort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'amount', label: 'Largest first' },
];

function listUrl(sort: InvoiceSort, page: number): string {
  const params = new URLSearchParams();
  if (sort !== 'newest') {
    params.set('sort', sort);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `/invoices?${query}` : '/invoices';
}

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const sort: InvoiceSort = single(params.sort) === 'amount' ? 'amount' : 'newest';
  const requested = Number.parseInt(single(params.page) ?? '1', 10) || 1;
  const list = await load<InvoicePageDto>(`/invoices?page=${requested}`, userId);
  const items = sort === 'amount' ? [...list.items].sort((a, b) => b.totalCents - a.totalCents) : list.items;
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
      {list.total === 0 ? (
        <p className="empty">No invoices yet.</p>
      ) : (
        <>
          <nav className="sort-tabs" aria-label="Sort the invoices">
            {SORTS.map((option) => (
              <a
                key={option.value}
                href={listUrl(option.value, 1)}
                className={option.value === sort ? 'current' : undefined}
                aria-current={option.value === sort ? 'page' : undefined}
              >
                {option.label}
              </a>
            ))}
          </nav>
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
              {items.map((invoice) => (
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
          <nav className="pagination" aria-label="Pages">
            <span className="muted">
              Page {list.page} of {list.pageCount}
            </span>
            {list.page > 1 ? (
              <a href={listUrl(sort, list.page - 1)} className="button secondary">
                Previous
              </a>
            ) : null}
            {list.page < list.pageCount ? (
              <a href={listUrl(sort, list.page + 1)} className="button secondary">
                Next
              </a>
            ) : null}
          </nav>
        </>
      )}
    </>
  );
}
