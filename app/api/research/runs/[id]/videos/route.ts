import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { PROMPT_VERSION } from '@/lib/research/ai/tasks/video-analysis';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'recent' ? 'recent' : 'viral';
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50) || 50));
  try {
    const sql = getDb();
    const runs = await sql<{ scraper_provider: string | null; scraper_note: string | null }[]>`
      select scraper_provider, scraper_note from research_runs where id = ${params.id} limit 1
    `;
    if (!runs[0]) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    const videos = sort === 'recent'
      ? await sql`
          select v.id, v.platform, v.platform_video_id, v.url, v.canonical_url, v.embed_url, v.thumbnail_url,
                 v.caption, v.author_handle, v.author_name, v.author_followers, v.views, v.likes, v.comments,
                 v.shares, v.saves, v.duration_seconds, v.published_at, v.transcript,
                 rv.engagement_score, rv.outlier_score, rv.freshness_score, rv.viral_score,
                 rv.is_high_potential, rv.score_components, rv.rank,
                 a.audience, a.pain_point, a.hook, a.hook_type, a.emotion, a.topic, a.content_structure,
                 a.viral_hypothesis, a.reusable_pattern, a.replicability, a.summary, a.status as analysis_status
          from research_run_videos rv
          join videos v on v.id = rv.video_id
          left join video_analyses a
            on a.run_id = rv.run_id and a.video_id = rv.video_id
           and a.prompt_version = ${PROMPT_VERSION} and a.status = 'complete'
          where rv.run_id = ${params.id}
          order by v.published_at desc nulls last
          limit ${limit}
        `
      : await sql`
          select v.id, v.platform, v.platform_video_id, v.url, v.canonical_url, v.embed_url, v.thumbnail_url,
                 v.caption, v.author_handle, v.author_name, v.author_followers, v.views, v.likes, v.comments,
                 v.shares, v.saves, v.duration_seconds, v.published_at, v.transcript,
                 rv.engagement_score, rv.outlier_score, rv.freshness_score, rv.viral_score,
                 rv.is_high_potential, rv.score_components, rv.rank,
                 a.audience, a.pain_point, a.hook, a.hook_type, a.emotion, a.topic, a.content_structure,
                 a.viral_hypothesis, a.reusable_pattern, a.replicability, a.summary, a.status as analysis_status
          from research_run_videos rv
          join videos v on v.id = rv.video_id
          left join video_analyses a
            on a.run_id = rv.run_id and a.video_id = rv.video_id
           and a.prompt_version = ${PROMPT_VERSION} and a.status = 'complete'
          where rv.run_id = ${params.id}
          order by rv.viral_score desc nulls last
          limit ${limit}
        `;
    return NextResponse.json({
      scraper_provider: runs[0].scraper_provider,
      scraper_note: runs[0].scraper_note,
      videos,
    });
  } catch (err) {
    console.error('[runs] videos failed', err);
    return NextResponse.json({ error: 'Could not load videos' }, { status: 500 });
  }
}
