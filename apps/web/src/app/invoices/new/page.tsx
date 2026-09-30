import type { ClientDto } from '@norbill/shared';
import { load, requireUserId, single, type SearchParams } from '@/lib/api';

const ERRORS: Record<string, string> = {
  invalid: 'Check the form: pick a client, fill in at least the first line and use positive numbers.',
  'unknown-client': 'This client does not exist.',
};

const LINES = [1, 2, 3];

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const clientList = await load<ClientDto[]>('/clients', userId);
  const params = await searchParams;
  const error = ERRORS[single(params.error) ?? ''];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="card">
      <h1>New invoice</h1>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {clientList.length === 0 ? (
        <p className="empty">
          Create a client before you create an invoice. <a href="/clients/new">New client</a>
        </p>
      ) : (
        <form className="form" action="/api/invoices" method="post">
          <div className="field-row">
            <div>
              <label htmlFor="clientId">Client</label>
              <select id="clientId" name="clientId" required>
                {clientList.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="issuedAt">Date</label>
              <input id="issuedAt" name="issuedAt" type="date" defaultValue={today} required />
            </div>
            <div>
              <label htmlFor="taxRate">Tax rate (%)</label>
              <input id="taxRate" name="taxRate" type="number" min={0} max={100} step="0.01" defaultValue="0" />
            </div>
          </div>
          {LINES.map((n) => (
            <div className="line-grid" key={n}>
              <div>
                <label htmlFor={`line-${n}-description`}>Line {n} description</label>
                <input id={`line-${n}-description`} name="description" type="text" maxLength={500} required={n === 1} />
              </div>
              <div>
                <label htmlFor={`line-${n}-quantity`}>Line {n} quantity</label>
                <input id={`line-${n}-quantity`} name="quantity" type="number" min="0.01" step="0.01" defaultValue={n === 1 ? '1' : ''} />
              </div>
              <div>
                <label htmlFor={`line-${n}-unit-price`}>Line {n} unit price</label>
                <input id={`line-${n}-unit-price`} name="unitPrice" type="number" min="0" step="0.01" placeholder="0.00" />
              </div>
            </div>
          ))}
          <div>
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} maxLength={2000} />
          </div>
          <div className="actions">
            <button type="submit" className="button">
              Create invoice
            </button>
            <a href="/invoices" className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      )}
    </section>
  );
}
