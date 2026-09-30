import { formatMoney, PLAN_LABELS, type DashboardDto, type MeDto } from '@norbill/shared';
import { load, requireUserId, single, type SearchParams } from '@/lib/api';

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const [me, stats] = await Promise.all([load<MeDto>('/me', userId), load<DashboardDto>('/dashboard', userId)]);
  const params = await searchParams;
  return (
    <>
      {single(params.confirmed) ? (
        <p className="alert success" role="status">
          Your email is confirmed. You are now logged in.
        </p>
      ) : null}
      <h1>Welcome, {me.workspace.name}</h1>
      <dl className="stats">
        <div className="stat">
          <dt>Clients</dt>
          <dd>{stats.clients}</dd>
        </div>
        <div className="stat">
          <dt>Invoices</dt>
          <dd>{stats.invoices}</dd>
        </div>
        <div className="stat">
          <dt>Amount sent</dt>
          <dd>{formatMoney(stats.sentTotalCents)}</dd>
        </div>
        <div className="stat">
          <dt>Plan</dt>
          <dd>{PLAN_LABELS[me.workspace.plan]}</dd>
        </div>
      </dl>
      <div className="spacer" />
      <div className="actions">
        <a href="/invoices/new" className="button">
          New invoice
        </a>
        <a href="/clients/new" className="button secondary">
          New client
        </a>
      </div>
    </>
  );
}
