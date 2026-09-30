import { api, field, seeOther } from '@/lib/api';
import { createSessionCookie } from '@/lib/session';

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const email = field(form, 'email');
  const password = form.get('password');
  if (!email || typeof password !== 'string' || !password) {
    return seeOther('/login?error=invalid');
  }
  const response = await api<{ userId?: string }>('/auth/login', { method: 'POST', body: { email, password } });
  if (response.status === 403) {
    return seeOther('/login?error=unconfirmed');
  }
  if (response.status !== 200 || !response.data?.userId) {
    return seeOther('/login?error=invalid');
  }
  return seeOther('/dashboard', createSessionCookie(response.data.userId));
}
