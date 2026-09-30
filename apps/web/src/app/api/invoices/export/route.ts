import { API_URL, seeOther } from '@/lib/api';
import { currentUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Downloads every invoice of the workspace as invoices.csv. */
export async function GET(): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) {
    return seeOther('/login');
  }
  const response = await fetch(`${API_URL}/invoices/export`, { headers: { 'x-user-id': userId }, cache: 'no-store' });
  if (response.status === 401) {
    return seeOther('/login');
  }
  if (!response.ok) {
    return new Response('The export failed.', { status: 502 });
  }
  const csv = await response.text();
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="invoices.csv"',
      'cache-control': 'no-store',
    },
  });
}
