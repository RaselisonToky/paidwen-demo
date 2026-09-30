import { api, seeOther } from '@/lib/api';
import { createSessionCookie } from '@/lib/session';

/** The confirmation link in the signup email points here. */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) {
    return seeOther('/login?error=invalid-token');
  }
  const response = await api<{ userId?: string }>('/auth/confirm', { method: 'POST', body: { token } });
  if (response.status !== 200 || !response.data?.userId) {
    return seeOther('/login?error=invalid-token');
  }
  return seeOther('/dashboard?confirmed=1', createSessionCookie(response.data.userId));
}
