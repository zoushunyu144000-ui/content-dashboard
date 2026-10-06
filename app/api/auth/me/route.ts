import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
  });
}
