import { api, seeOther } from '@/lib/api';
import { currentUserId } from '@/lib/session';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) {
    return seeOther('/login');
  }
  const { id } = await context.params;
  const path = `/invoices/${encodeURIComponent(id)}`;
  const response = await api(`${path}/send`, { method: 'POST', userId });
  if (response.status === 401) {
    return seeOther('/login');
  }
  if (response.status !== 200) {
    return seeOther(`${path}?error=send-failed`);
  }
  return seeOther(`${path}?sent=1`);
}
