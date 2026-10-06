import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { asNumber } from '@/lib/research/insight-groups';
import { RELEVANCE_MIN } from '@/lib/research/relevance';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const highPotential = await sql<{ n: number }[]>`
      select count(*)::int as n
      from research_run_videos rv
      left join lateral (
        select relevance
        from video_analyses
        where run_id = rv.run_id and video_id = rv.video_id and status = 'complete'
        order by created_at desc
        limit 1
      ) a on true
      where rv.run_id = ${params.id}
        and rv.is_high_potential
        and (a.relevance is null or a.relevance >= ${RELEVANCE_MIN})
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
      high_potential: Number(highPotential[0]?.n || 0),
      analyzed: Number(coverage[0]?.analyzed || 0),
      on_topic: Number(coverage[0]?.on_topic || 0),
    });
  } catch (err) {
    console.error('[runs] insights failed', err);
    return NextResponse.json({ error: 'Could not load insights' }, { status: 500 });
  }
}
