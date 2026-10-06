import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { asNumber } from '@/lib/research/insight-groups';
import { ReclusterError, reclusterRun } from '@/lib/research/pipeline';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const insights = await reclusterRun(params.id);
    const sql = getDb();
    const clusters = await sql`
      select id, kind, label, summary, video_count, percent, rank, method, source_labels
      from insight_clusters
      where run_id = ${params.id}
      order by kind, video_count desc
    `;
    return NextResponse.json({
      insights,
      clusters: clusters.map((cluster) => ({
        ...cluster,
        video_count: asNumber(cluster.video_count),
        percent: asNumber(cluster.percent),
      })),
    });
  } catch (err) {
    if (err instanceof ReclusterError) {
      if (err.code === 'not_found') return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      return NextResponse.json({ error: 'Only a completed run can be reclustered' }, { status: 409 });
    }
    console.error('[runs] recluster failed', err);
    return NextResponse.json({ error: 'Could not recluster this run' }, { status: 500 });
  }
}
