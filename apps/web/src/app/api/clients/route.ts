import { api, field, seeOther } from '@/lib/api';
import { currentUserId } from '@/lib/session';

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) {
    return seeOther('/login');
  }
  const form = await request.formData();
  const name = field(form, 'name');
  const email = field(form, 'email');
  if (!name || !email) {
    return seeOther('/clients/new?error=invalid');
  }
  const response = await api('/clients', { method: 'POST', body: { name, email }, userId });
  if (response.status === 401) {
    return seeOther('/login');
  }
  if (response.status !== 201) {
    return seeOther('/clients/new?error=invalid');
  }
  return seeOther('/clients?created=1');
}
