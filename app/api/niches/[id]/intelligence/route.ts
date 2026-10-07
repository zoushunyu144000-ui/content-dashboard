import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  generateNicheIntelligence,
  getLatestNicheIntelligence,
  IntelligenceInputError,
  IntelligenceNotFoundError,
  parseNicheWindow,
  type NicheWindow,
} from '@/lib/research/intelligence';

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOWS: NicheWindow[] = ['7d', '30d', 'all'];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  let window: NicheWindow;
  try {
    window = parseNicheWindow(new URL(request.url).searchParams.get('window'));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid window';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  try {
    const report = await getLatestNicheIntelligence(params.id, window);
    return NextResponse.json({ report });
  } catch (err) {
    console.error('[intelligence] niche read failed', err);
    return NextResponse.json({ error: 'Could not load intelligence' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  const requested = new URL(request.url).searchParams.get('window') || 'all';
  try {
    if (requested === 'every') {
      const reports = [];
      for (const window of WINDOWS) {
        reports.push(await generateNicheIntelligence(params.id, window));
      }
      return NextResponse.json({ reports });
    }
    const report = await generateNicheIntelligence(params.id, parseNicheWindow(requested));
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof IntelligenceNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof IntelligenceInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const detail = err instanceof Error ? err.message : 'AI request failed';
    console.error('[intelligence] niche generate failed', err);
    return NextResponse.json({ error: 'AI 分析失败', detail }, { status: 502 });
  }
}
