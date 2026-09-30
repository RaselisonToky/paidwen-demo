import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import nodemailer, { type Transporter } from 'nodemailer';
import { Pool } from 'pg';

const QUEUE_NAME = 'norbill';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://norbill:norbill@localhost:5432/norbill';
const MAIL_FROM = process.env.MAIL_FROM ?? 'Norbill <no-reply@norbill.test>';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EmailJob {
  to: string;
  subject: string;
  text: string;
}

interface StripeEventJob {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}

const pool = new Pool({ connectionString: DATABASE_URL });
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

function createTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn('[worker] SMTP_HOST is not set: emails are printed to this log instead of being sent');
    return null;
  }
  const user = process.env.SMTP_USER;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 25),
    secure: false,
    auth: user ? { user, pass: process.env.SMTP_PASSWORD ?? '' } : undefined,
  });
}

const transport = createTransport();

async function sendEmail(job: EmailJob): Promise<void> {
  if (!transport) {
    console.log(`[worker] email to ${job.to}\nSubject: ${job.subject}\n\n${job.text}\n`);
    return;
  }
  await transport.sendMail({ from: MAIL_FROM, to: job.to, subject: job.subject, text: job.text });
  console.log(`[worker] sent "${job.subject}" to ${job.to}`);
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

async function handleStripeEvent(event: StripeEventJob): Promise<void> {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case 'checkout.session.completed': {
      const metadata = (object.metadata ?? {}) as Record<string, unknown>;
      const workspaceId = idOf(object.client_reference_id) ?? idOf(metadata.workspaceId);
      if (!workspaceId || !UUID.test(workspaceId)) {
        console.warn(`[worker] ${event.id}: checkout session without a workspace reference, ignored`);
        return;
      }
      await pool.query(
        `update workspaces set plan = 'pro', stripe_customer_id = $2, stripe_subscription_id = $3 where id = $1`,
        [workspaceId, idOf(object.customer), idOf(object.subscription)],
      );
      console.log(`[worker] workspace ${workspaceId} is now on the Pro plan`);
      return;
    }
    case 'customer.subscription.deleted': {
      const subscriptionId = idOf(object.id);
      if (!subscriptionId) {
        return;
      }
      await pool.query(`update workspaces set plan = 'free', stripe_subscription_id = null where stripe_subscription_id = $1`, [
        subscriptionId,
      ]);
      console.log(`[worker] subscription ${subscriptionId} ended, workspace back on the Free plan`);
      return;
    }
    default:
      console.log(`[worker] ignoring Stripe event ${event.type}`);
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    switch (job.name) {
      case 'send-email':
        return sendEmail(job.data as EmailJob);
      case 'stripe-event':
        return handleStripeEvent(job.data as StripeEventJob);
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  },
  { connection, concurrency: 5 },
);

worker.on('ready', () => console.log('[worker] ready, waiting for jobs'));
worker.on('completed', (job) => console.log(`[worker] ${job.name} ${job.id} completed`));
worker.on('failed', (job, error) => console.error(`[worker] ${job?.name} ${job?.id} failed: ${error.message}`));
worker.on('error', (error) => console.error(`[worker] ${error.message}`));

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] received ${signal}, shutting down`);
  await worker.close();
  await pool.end();
  connection.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
