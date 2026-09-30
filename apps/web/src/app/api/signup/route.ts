import { api, field, seeOther } from '@/lib/api';

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const companyName = field(form, 'companyName');
  const email = field(form, 'email');
  const password = form.get('password');
  if (!companyName || !email || typeof password !== 'string' || password.length < 8) {
    return seeOther('/signup?error=invalid');
  }
  const response = await api('/auth/signup', { method: 'POST', body: { companyName, email, password } });
  if (response.status === 409) {
    return seeOther('/signup?error=email-taken');
  }
  if (response.status !== 201) {
    return seeOther('/signup?error=invalid');
  }
  return seeOther(`/signup?sent=1&email=${encodeURIComponent(email)}`);
}
