import type { FastifyPluginAsync } from 'fastify';
import { count, eq, sql, sum } from 'drizzle-orm';
import Stripe from 'stripe';
import type { BillingDto, DashboardDto, MeDto, Plan } from '@norbill/shared';
import { db } from '../db';
import { clients, invoices } from '../schema';
import { queueStripeEvent } from '../queue';

const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Builds the Stripe client. STRIPE_API_BASE redirects every call, for example to stripe-mock. */
function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  const base = process.env.STRIPE_API_BASE;
  if (!base) {
    return new Stripe(key);
  }
  const url = new URL(base);
  const secure = url.protocol === 'https:';
  return new Stripe(key, {
    host: url.hostname,
    port: url.port ? Number(url.port) : secure ? 443 : 80,
    protocol: secure ? 'https' : 'http',
  });
}

function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
}

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request): Promise<MeDto> => ({
    user: { id: request.user.id, email: request.user.email },
    workspace: { id: request.user.workspaceId, name: request.user.workspaceName, plan: request.user.plan as Plan },
  }));

  app.get('/dashboard', async (request): Promise<DashboardDto> => {
    const workspaceId = request.user.workspaceId;
    const [clientStats] = await db.select({ count: count() }).from(clients).where(eq(clients.workspaceId, workspaceId));
    const [invoiceStats] = await db
      .select({
        count: count(),
        sentTotal: sum(sql`case when ${invoices.status} = 'sent' then ${invoices.totalCents} else 0 end`),
      })
      .from(invoices)
      .where(eq(invoices.workspaceId, workspaceId));
    return {
      clients: clientStats?.count ?? 0,
      invoices: invoiceStats?.count ?? 0,
      sentTotalCents: Number(invoiceStats?.sentTotal ?? 0),
    };
  });

  app.get('/billing', async (request): Promise<BillingDto> => ({
    plan: request.user.plan as Plan,
    paymentsConfigured: paymentsConfigured(),
    workspaceId: request.user.workspaceId,
  }));

  app.post('/billing/checkout', async (request, reply) => {
    const stripe = stripeClient();
    const price = process.env.STRIPE_PRICE_PRO;
    if (!stripe || !price) {
      return reply.code(503).send({ error: 'payments-not-configured' });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      customer_email: request.user.email,
      metadata: { workspace_id: request.user.workspaceId },
      success_url: `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/billing`,
    });
    if (!session.url) {
      return reply.code(502).send({ error: 'no-checkout-url' });
    }
    return { url: session.url };
  });
};

interface IncomingEvent {
  id: string;
  type: string;
  data: unknown;
}

/** Stripe webhooks arrive with a raw body so that the signature can be verified. */
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

  app.post('/webhooks/stripe', async (request, reply) => {
    const payload = request.body;
    if (!Buffer.isBuffer(payload) || payload.length === 0) {
      return reply.code(400).send({ error: 'empty-body' });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: IncomingEvent;
    if (secret) {
      const signature = request.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        return reply.code(400).send({ error: 'missing-signature' });
      }
      try {
        const stripe = stripeClient() ?? new Stripe('sk_test_placeholder');
        event = stripe.webhooks.constructEvent(payload, signature, secret);
      } catch (error) {
        request.log.warn({ err: error }, 'Rejected a Stripe webhook with an invalid signature');
        return reply.code(400).send({ error: 'invalid-signature' });
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        return reply.code(503).send({ error: 'webhook-secret-missing' });
      }
      request.log.warn('STRIPE_WEBHOOK_SECRET is not set, accepting the Stripe event without checking its signature');
      let parsed: Partial<IncomingEvent>;
      try {
        parsed = JSON.parse(payload.toString('utf8')) as Partial<IncomingEvent>;
      } catch {
        return reply.code(400).send({ error: 'invalid-json' });
      }
      if (!parsed || typeof parsed.id !== 'string' || typeof parsed.type !== 'string') {
        return reply.code(400).send({ error: 'invalid-event' });
      }
      event = { id: parsed.id, type: parsed.type, data: parsed.data ?? {} };
    }
    await queueStripeEvent({ id: event.id, type: event.type, data: event.data });
    return { received: true };
  });
};
