import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
