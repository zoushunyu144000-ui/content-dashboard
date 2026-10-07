import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getReanalyzeStatus, reanalyzeNiche } from '@/lib/research/reanalyze';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(getReanalyzeStatus());
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const niche = new URL(request.url).searchParams.get('niche');
  if (niche && !UUID.test(niche)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  if (!getReanalyzeStatus().running) {
    void reanalyzeNiche(niche || null, { concurrency: 3, batch: 8 }).catch((err) => {
      console.error('[reanalyze] failed', err);
    });
  }
  return NextResponse.json(getReanalyzeStatus());
}
