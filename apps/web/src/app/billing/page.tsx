import { PLAN_LABELS, type BillingDto } from '@norbill/shared';
import { load, requireUserId, single, type SearchParams } from '@/lib/api';

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requireUserId();
  const billing = await load<BillingDto>('/billing', userId);
  const params = await searchParams;
  const sessionId = single(params.session_id);
  const error = single(params.error);
  return (
    <>
      <h1>Billing</h1>
      {sessionId ? (
        <p className="alert success" role="status">
          Thank you. Your plan updates as soon as Stripe confirms the payment.
        </p>
      ) : null}
      {error === 'not-configured' ? (
        <p className="alert error" role="alert">
          The subscription could not start because payments are not configured on this server.
        </p>
      ) : null}
      <dl className="details">
        <dt>Current plan</dt>
        <dd data-testid="current-plan">{PLAN_LABELS[billing.plan]}</dd>
        <dt>Workspace ID</dt>
        <dd data-testid="workspace-id">{billing.workspaceId}</dd>
      </dl>
      {billing.plan === 'pro' ? (
        <p>You are on the Pro plan.</p>
      ) : billing.paymentsConfigured ? (
        <form action="/api/billing/checkout" method="post">
          <button type="submit" className="button">
            Subscribe to Pro
          </button>
        </form>
      ) : (
        <p className="muted">Payments are not configured.</p>
      )}
    </>
  );
}
