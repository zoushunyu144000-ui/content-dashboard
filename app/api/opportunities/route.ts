import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { listOpportunities, OpportunityInputError } from '@/lib/research/opportunities';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const niche = new URL(request.url).searchParams.get('niche')?.trim() || '';
  if (!niche) return NextResponse.json({ error: 'niche is required' }, { status: 400 });
  if (!UUID.test(niche)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const opportunities = await listOpportunities(niche);
    return NextResponse.json({ opportunities });
  } catch (err) {
    if (err instanceof OpportunityInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[opportunities] list failed', err);
    return NextResponse.json({ error: 'Could not load opportunities' }, { status: 500 });
  }
}
