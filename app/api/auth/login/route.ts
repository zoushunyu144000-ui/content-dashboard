import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth/session';
import { clientIp, loginBlocked, recordLoginFailure } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (loginBlocked(ip)) {
    return NextResponse.json({ error: 'too many attempts' }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const rows = await sql<{ id: string; email: string; password_hash: string; role: 'admin' | 'member' }[]>`
      select id, email, password_hash, role
      from users
      where lower(email) = ${email}
      limit 1
    `;
    const user = rows[0];
    const matches = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !matches) {
      recordLoginFailure(ip);
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
    }
    await sql`update users set last_login_at = now() where id = ${user.id}`;
    await setSessionCookie({ id: user.id, email: user.email, role: user.role });
    return NextResponse.json({ ok: true, email: user.email, role: user.role });
  } catch (err) {
    console.error('[auth] login failed', err);
    return NextResponse.json({ error: 'login failed' }, { status: 500 });
  }
}
