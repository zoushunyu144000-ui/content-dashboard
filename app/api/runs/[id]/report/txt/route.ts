import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { AudienceInputError, AudienceNotFoundError, generateAudienceIntelligence } from '@/lib/research/audience';
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

class AudienceGenerateError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'AudienceGenerateError';
  }
}

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
    if (err instanceof ReportNotFoundError || err instanceof AudienceNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ReportInputError || err instanceof AudienceInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ReportAIError || err instanceof AudienceGenerateError) {
      console.error('[report.txt] generate failed', err);
      return NextResponse.json({ error: 'AI 分析失败', detail: err.message }, { status: 502 });
    }
    console.error('[report.txt] failed', err);
    return NextResponse.json({ error: 'Could not export report' }, { status: 500 });
  }
}

async function loadOrGenerate(runId: string): Promise<ResearchReport> {
  const sql = getDb();
  const counted = await sql<{ count: number; created_at: Date | string | null }[]>`
    select count(*)::int as count, max(created_at) as created_at
    from audience_insights
    where run_id = ${runId} and status = 'active'
  `;
  const activeCount = Number(counted[0]?.count ?? 0);
  const newestInsightAt = counted[0]?.created_at ?? null;

  if (activeCount === 0) {
    try {
      await generateAudienceIntelligence(runId);
    } catch (err) {
      if (err instanceof AudienceNotFoundError || err instanceof AudienceInputError) throw err;
      const detail = err instanceof Error ? err.message : 'AI request failed';
      throw new AudienceGenerateError(detail);
    }
    return generateFreshReport(runId);
  }

  const existing = await getLatestResearchReport(runId);
  if (!existing || isOlderThan(existing.created_at, newestInsightAt)) {
    return generateFreshReport(runId);
  }
  return existing;
}

function isOlderThan(reportAt: Date | string, insightAt: Date | string | null): boolean {
  if (!insightAt) return false;
  const reportMs = new Date(reportAt).getTime();
  const insightMs = new Date(insightAt).getTime();
  return Number.isFinite(reportMs) && Number.isFinite(insightMs) && reportMs < insightMs;
}

async function generateFreshReport(runId: string): Promise<ResearchReport> {
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
