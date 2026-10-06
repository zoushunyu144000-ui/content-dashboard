import 'server-only';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readSessionCookie } from '@/lib/auth/session';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
}

export async function requireUser(): Promise<{ user: AuthUser } | NextResponse> {
  try {
    const session = await readSessionCookie();
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const sql = getDb();
    const rows = await sql<{ id: string; email: string; role: 'admin' | 'member' }[]>`
      select id, email, role from users where id = ${session.sub} limit 1
    `;
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return { user };
  } catch (err) {
    console.error('[auth] requireUser failed', err);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function requireAdmin(): Promise<{ user: AuthUser } | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return auth;
}
