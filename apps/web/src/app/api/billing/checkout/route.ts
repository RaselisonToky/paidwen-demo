import { api, seeOther } from '@/lib/api';
import { currentUserId } from '@/lib/session';

/** Asks the API for a Stripe Checkout session and sends the browser there. */
export async function POST(): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) {
    return seeOther('/login');
  }
  const response = await api<{ url?: string }>('/billing/checkout', { method: 'POST', userId });
  if (response.status === 401) {
    return seeOther('/login');
  }
  if (response.status !== 200 || !response.data?.url) {
    return seeOther('/billing?error=not-configured');
  }
  return seeOther(response.data.url);
}
