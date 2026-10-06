import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { RELEVANCE_MIN } from '@/lib/research/relevance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getDb();
    const projects = await sql<{ n: number }[]>`
      select count(*)::int as n from projects where archived_at is null
    `;
    const runs = await sql`
      select id, project_id, topic, status, progress, scraper_provider, scraper_note, created_at
      from research_runs
      order by created_at desc
      limit 8
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
      where rv.is_high_potential
        and (a.relevance is null or a.relevance >= ${RELEVANCE_MIN})
    `;
    return NextResponse.json({
      projects: Number(projects[0]?.n || 0),
      high_potential: Number(highPotential[0]?.n || 0),
      runs,
    });
  } catch (err) {
    console.error('[dashboard] failed', err);
    return NextResponse.json({ error: 'Could not load dashboard' }, { status: 500 });
  }
}
