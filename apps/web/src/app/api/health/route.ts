import { API_URL } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** The web app is healthy when it can reach the API. */
export async function GET(): Promise<Response> {
  try {
    const response = await fetch(`${API_URL}/health`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return Response.json({ status: 'ok', api: 'ok' });
    }
    return Response.json({ status: 'error', api: `status ${response.status}` }, { status: 503 });
  } catch (error) {
    return Response.json({ status: 'error', api: error instanceof Error ? error.message : 'unreachable' }, { status: 503 });
  }
}
