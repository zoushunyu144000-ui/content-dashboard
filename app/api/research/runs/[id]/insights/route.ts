import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

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
      select count(*)::int as n from research_run_videos
      where run_id = ${params.id} and is_high_potential
    `;
    return NextResponse.json({
      run: runs[0],
      clusters,
      high_potential: Number(highPotential[0]?.n || 0),
    });
  } catch (err) {
    console.error('[runs] insights failed', err);
    return NextResponse.json({ error: 'Could not load insights' }, { status: 500 });
  }
}
