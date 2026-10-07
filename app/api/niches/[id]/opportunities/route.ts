import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  generateOpportunities,
  OpportunityInputError,
  OpportunityNicheNotFoundError,
} from '@/lib/research/opportunities';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const opportunities = await generateOpportunities(params.id);
    return NextResponse.json({ opportunities });
  } catch (err) {
    if (err instanceof OpportunityNicheNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof OpportunityInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const detail = err instanceof Error ? err.message : 'AI request failed';
    console.error('[opportunities] generate failed', err);
    return NextResponse.json({ error: 'AI 分析失败', detail }, { status: 502 });
  }
}
