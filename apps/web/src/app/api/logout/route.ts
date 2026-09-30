import { seeOther } from '@/lib/api';
import { clearSessionCookie } from '@/lib/session';

export async function POST(): Promise<Response> {
  return seeOther('/login', clearSessionCookie());
}
