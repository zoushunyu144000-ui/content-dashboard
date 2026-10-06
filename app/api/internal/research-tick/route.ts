import { NextResponse } from 'next/server';
import { bearerMatches } from '@/lib/auth/constant-time';
import { tickOnce } from '@/lib/research/pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET?.trim();
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await tickOnce(`worker-${process.pid}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[research-tick]', err);
    const message = err instanceof Error ? err.message : 'tick failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
