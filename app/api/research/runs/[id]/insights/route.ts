import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { asNumber } from '@/lib/research/insight-groups';
import { RELEVANCE_MIN } from '@/lib/research/relevance';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function metricOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const sql = getDb();
    const runs = await sql`
      select id, status, insights, scraper_provider, scraper_note
      from research_runs where id = ${params.id} limit 1
    `;
    if (!runs[0]) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    const clusters = await sql`
      select id, kind, label, summary, video_count, percent, rank, method, source_labels
      from insight_clusters
      where run_id = ${params.id}
      order by kind, video_count desc
    `;
    const highPotential = await sql<
      {
        id: string;
        platform: string | null;
        url: string | null;
        thumbnail_url: string | null;
        author_handle: string | null;
        views: unknown;
        likes: unknown;
        viral_score: unknown;
        is_high_potential: boolean | null;
        hook: string | null;
      }[]
    >`
      select v.id, v.platform, v.url, v.thumbnail_url, v.author_handle, v.views, v.likes,
             rv.viral_score, rv.is_high_potential, a.hook
      from research_run_videos rv
      join videos v on v.id = rv.video_id
      left join lateral (
        select hook, relevance
        from video_analyses
        where run_id = rv.run_id and video_id = rv.video_id and status = 'complete'
        order by created_at desc
        limit 1
      ) a on true
      where rv.run_id = ${params.id}
        and rv.is_high_potential
        and (a.relevance is null or a.relevance >= ${RELEVANCE_MIN})
      order by rv.viral_score desc nulls last
    `;
    const coverage = await sql<{ analyzed: number; on_topic: number }[]>`
      select
        count(*)::int as analyzed,
        count(*) filter (where relevance is null or relevance >= ${RELEVANCE_MIN})::int as on_topic
      from (
        select distinct on (video_id) relevance
        from video_analyses
        where run_id = ${params.id} and status = 'complete'
        order by video_id, created_at desc
      ) latest
    `;
    return NextResponse.json({
      run: runs[0],
      clusters: clusters.map((cluster) => ({
        ...cluster,
        video_count: asNumber(cluster.video_count),
        percent: asNumber(cluster.percent),
      })),
      high_potential: highPotential.map((video) => ({
        id: video.id,
        platform: video.platform,
        url: video.url,
        thumbnail_url: video.thumbnail_url,
        author_handle: video.author_handle,
        views: metricOrNull(video.views),
        likes: metricOrNull(video.likes),
        viral_score: metricOrNull(video.viral_score),
        is_high_potential: Boolean(video.is_high_potential),
        hook: video.hook,
      })),
      analyzed: Number(coverage[0]?.analyzed || 0),
      on_topic: Number(coverage[0]?.on_topic || 0),
    });
  } catch (err) {
    console.error('[runs] insights failed', err);
    return NextResponse.json({ error: 'Could not load insights' }, { status: 500 });
  }
}
