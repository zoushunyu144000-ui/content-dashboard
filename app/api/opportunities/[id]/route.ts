import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getOpportunity, OpportunityInputError } from '@/lib/research/opportunities';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid opportunity id' }, { status: 400 });
  try {
    const result = await getOpportunity(params.id);
    if (!result) return NextResponse.json({ error: 'Opportunity was not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OpportunityInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[opportunities] read failed', err);
    return NextResponse.json({ error: 'Could not load opportunity' }, { status: 500 });
  }
}
