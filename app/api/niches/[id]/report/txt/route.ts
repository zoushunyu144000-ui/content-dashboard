import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { buildProjectReportTxt, ProjectReportNotFoundError } from '@/lib/research/niche-report';
import { contentDisposition } from '@/lib/research/report-txt';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });
  try {
    const report = await buildProjectReportTxt(params.id);
    return new Response(report.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': contentDisposition(report.filename),
      },
    });
  } catch (err) {
    if (err instanceof ProjectReportNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error('[niche.report.txt] failed', err);
    return NextResponse.json({ error: 'Could not export project report' }, { status: 500 });
  }
}
