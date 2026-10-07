import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getNiche, NicheInputError, NicheNotFoundError, updateNiche } from '@/lib/research/niches';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const niche = await getNiche(params.id);
    if (!niche) return NextResponse.json({ error: 'Niche was not found' }, { status: 404 });
    return NextResponse.json({ niche });
  } catch (err) {
    console.error('[niches] read failed', err);
    return NextResponse.json({ error: 'Could not load niche' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const niche = await updateNiche(params.id, body);
    return NextResponse.json({ niche });
  } catch (err) {
    if (err instanceof NicheInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof NicheNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('[niches] update failed', err);
    return NextResponse.json({ error: 'Could not update niche' }, { status: 500 });
  }
}
