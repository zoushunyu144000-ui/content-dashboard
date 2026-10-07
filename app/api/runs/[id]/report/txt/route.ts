import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  generateResearchReport,
  getLatestResearchReport,
  ReportAIError,
  ReportInputError,
  ReportNotFoundError,
  type ResearchReport,
} from '@/lib/research/report';
import { contentDisposition, renderReportTxt, researchReportFilename } from '@/lib/research/report-txt';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const report = await loadOrGenerate(params.id);
    const url = new URL(request.url);
    if (url.searchParams.get('format') === 'json') {
      return NextResponse.json(report.report_json);
    }
    const filename = researchReportFilename(report.report_json.overview?.topic || 'research', ymd(report.created_at));
    const body = renderReportTxt(report.report_json, report.executive_summary);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': contentDisposition(filename),
      },
    });
  } catch (err) {
    if (err instanceof ReportNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ReportInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ReportAIError) {
      console.error('[report.txt] generate failed', err);
      return NextResponse.json({ error: 'AI 分析失败', detail: err.message }, { status: 502 });
    }
    console.error('[report.txt] failed', err);
    return NextResponse.json({ error: 'Could not export report' }, { status: 500 });
  }
}

async function loadOrGenerate(runId: string): Promise<ResearchReport> {
  const existing = await getLatestResearchReport(runId);
  if (existing) return existing;
  try {
    return await generateResearchReport(runId);
  } catch (err) {
    if (err instanceof ReportAIError) return err.report;
    throw err;
  }
}

function ymd(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
