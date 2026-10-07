import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  generateResearchReport,
  getLatestResearchReport,
  ReportAIError,
  ReportInputError,
  ReportNotFoundError,
} from '@/lib/research/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const report = await getLatestResearchReport(params.id);
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof ReportInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[report] read failed', err);
    return NextResponse.json({ error: 'Could not load report' }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const report = await generateResearchReport(params.id);
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof ReportNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ReportInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ReportAIError) {
      console.error('[report] generate failed', err);
      return NextResponse.json({ error: 'AI 分析失败', detail: err.message }, { status: 502 });
    }
    console.error('[report] generate failed', err);
    return NextResponse.json({ error: 'Could not generate report' }, { status: 500 });
  }
}
