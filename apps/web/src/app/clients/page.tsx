import type { ClientDto } from '@norbill/shared';
import { load, requireUserId, single, type SearchParams } from '@/lib/api';

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const clientList = await load<ClientDto[]>('/clients', userId);
  const params = await searchParams;
  return (
    <>
      <div className="page-header">
        <h1>Clients</h1>
        <a href="/clients/new" className="button">
          New client
        </a>
      </div>
      {single(params.created) ? (
        <p className="alert success" role="status">
          Client created.
        </p>
      ) : null}
      {clientList.length === 0 ? (
        <p className="empty">No clients yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {clientList.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{client.email}</td>
                <td>{client.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
