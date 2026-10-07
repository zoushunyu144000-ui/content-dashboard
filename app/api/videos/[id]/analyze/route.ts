import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { analyzeVideoBatch } from '@/lib/research/reanalyze';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveNiche(videoId: string, requested: string | null): Promise<string | null> {
  if (requested) return requested;
  const sql = getDb();
  const fromAnalysis = await sql<{ niche_id: string }[]>`
    select niche_id
    from video_analyses
    where video_id = ${videoId} and niche_id is not null
    order by is_latest desc, created_at desc
    limit 1
  `;
  if (fromAnalysis[0]?.niche_id) return fromAnalysis[0].niche_id;
  const fromRun = await sql<{ project_id: string }[]>`
    select r.project_id
    from research_run_videos rv
    join research_runs r on r.id = rv.run_id
    where rv.video_id = ${videoId}
    order by rv.viral_score desc nulls last
    limit 1
  `;
  return fromRun[0]?.project_id ?? null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });

  let body: Record<string, unknown> = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  const requested = typeof body.niche_id === 'string' && body.niche_id.trim() ? body.niche_id.trim() : null;
  if (requested && !UUID.test(requested)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });

  let sql: ReturnType<typeof getDb>;
  let nicheId: string | null;
  try {
    sql = getDb();
    const videos = await sql<{ id: string }[]>`select id from videos where id = ${params.id} limit 1`;
    if (!videos[0]) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    nicheId = await resolveNiche(params.id, requested);
    if (!nicheId) return NextResponse.json({ error: 'Could not determine niche' }, { status: 400 });
    const niches = await sql<{ id: string }[]>`select id from projects where id = ${nicheId} limit 1`;
    if (!niches[0]) return NextResponse.json({ error: 'Niche was not found' }, { status: 404 });
  } catch (err) {
    console.error('[videos] analyze lookup failed', err);
    return NextResponse.json({ error: 'Could not analyze video' }, { status: 500 });
  }

  try {
    await analyzeVideoBatch(nicheId, [params.id]);
    const analyses = await sql`
      select id, run_id, video_id, niche_id,
             audience, audience_category, pain_point, pain_point_category,
             hook, hook_type, emotion, topic, topic_category,
             content_structure, content_format, cta_type,
             why_it_works, what_not_to_copy,
             viral_hypothesis, reusable_pattern,
             replicability, replicability_score, relevance, relevance_reason,
             hook_text, summary, value_types, tags,
             model, prompt_version, analysis_version,
             status, error, is_latest, created_at
      from video_analyses
      where video_id = ${params.id} and is_latest = true
      order by created_at desc
      limit 1
    `;
    return NextResponse.json({ analysis: analyses[0] ?? null });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'AI analysis failed';
    console.error('[videos] analyze failed', err);
    return NextResponse.json({ error: 'AI 分析失败', detail }, { status: 502 });
  }
}
