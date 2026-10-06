import 'server-only';
import { getDb } from '@/lib/db';
import { getServerEnv } from '@/lib/env.server';
import { setSessionCookie } from '@/lib/auth/session';

export interface OpenAdminUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
}

/**
 * Look up ADMIN_EMAIL and set a normal ci_session cookie.
 * Used when AUTH_MODE=open so requireUser() keeps working without a login form.
 */
export async function issueOpenAdminSession(): Promise<OpenAdminUser | null> {
  const email = getServerEnv().adminEmail;
  if (!email) {
    console.error('[auth] AUTH_MODE=open but ADMIN_EMAIL is not set');
    return null;
  }
  const sql = getDb();
  const rows = await sql<{ id: string; email: string; role: 'admin' | 'member' }[]>`
    select id, email, role from users where lower(email) = ${email} limit 1
  `;
  const user = rows[0];
  if (!user) {
    console.error('[auth] AUTH_MODE=open but admin user is missing; run boot ensureAdmin');
    return null;
  }
  await setSessionCookie({ id: user.id, email: user.email, role: user.role });
  return { id: user.id, email: user.email, role: user.role };
}
