import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  getNicheDashboard,
  OpportunityInputError,
  OpportunityNicheNotFoundError,
} from '@/lib/research/opportunities';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const dashboard = await getNicheDashboard(params.id);
    return NextResponse.json(dashboard);
  } catch (err) {
    if (err instanceof OpportunityNicheNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof OpportunityInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[dashboard] load failed', err);
    return NextResponse.json({ error: 'Could not load dashboard' }, { status: 500 });
  }
}
