import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  createNiche,
  listNiches,
  NicheConflictError,
  NicheInputError,
  NicheNotFoundError,
  updateNiche,
} from '@/lib/research/niches';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const niches = await listNiches();
    return NextResponse.json({ niches });
  } catch (err) {
    console.error('[niches] list failed', err);
    return NextResponse.json({ error: 'Could not load niches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const niche = await createNiche(body);
    return NextResponse.json({ niche }, { status: 201 });
  } catch (err) {
    if (err instanceof NicheInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof NicheConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('[niches] create failed', err);
    return NextResponse.json({ error: 'Could not create niche' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const niche = await updateNiche(id, body);
    return NextResponse.json({ niche });
  } catch (err) {
    if (err instanceof NicheInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof NicheNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('[niches] update failed', err);
    return NextResponse.json({ error: 'Could not update niche' }, { status: 500 });
  }
}
