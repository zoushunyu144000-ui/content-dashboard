import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getNicheOverview } from '@/lib/research/niches';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const overview = await getNicheOverview(params.id);
    if (!overview) return NextResponse.json({ error: 'Niche was not found' }, { status: 404 });
    return NextResponse.json(overview);
  } catch (err) {
    console.error('[niches] overview failed', err);
    return NextResponse.json({ error: 'Could not load niche overview' }, { status: 500 });
  }
}
