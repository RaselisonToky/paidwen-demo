import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const QUEUE_NAME = 'norbill';

export interface EmailJob {
  to: string;
  subject: string;
  text: string;
}

export interface StripeEventJob {
  id: string;
  type: string;
  data: unknown;
}

let queue: Queue | undefined;

function getQueue(): Queue {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }
  return queue;
}

export async function queueEmail(job: EmailJob): Promise<void> {
  await getQueue().add('send-email', job);
}

export async function queueStripeEvent(event: StripeEventJob): Promise<void> {
  await getQueue().add('stripe-event', event, { jobId: `stripe-${event.id}` });
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
}
