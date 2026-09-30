import { API_URL } from '@/lib/api';

/** Stripe reaches the API through the web app: the raw body and the signature are forwarded untouched. */
export async function POST(request: Request): Promise<Response> {
  const body = await request.arrayBuffer();
  const headers: Record<string, string> = {
    'content-type': request.headers.get('content-type') ?? 'application/json',
  };
  const signature = request.headers.get('stripe-signature');
  if (signature) {
    headers['stripe-signature'] = signature;
  }
  const response = await fetch(`${API_URL}/webhooks/stripe`, { method: 'POST', headers, body, cache: 'no-store' });
  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}
