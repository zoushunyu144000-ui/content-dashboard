import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  generateRunIntelligence,
  getLatestRunIntelligence,
  IntelligenceInputError,
  IntelligenceNotFoundError,
} from '@/lib/research/intelligence';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const report = await getLatestRunIntelligence(params.id);
    return NextResponse.json({ report });
  } catch (err) {
    console.error('[intelligence] run read failed', err);
    return NextResponse.json({ error: 'Could not load intelligence' }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const report = await generateRunIntelligence(params.id);
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof IntelligenceNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof IntelligenceInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const detail = err instanceof Error ? err.message : 'AI request failed';
    console.error('[intelligence] run generate failed', err);
    return NextResponse.json({ error: 'AI 分析失败', detail }, { status: 502 });
  }
}
