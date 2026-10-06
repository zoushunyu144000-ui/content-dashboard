import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

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
      select count(*)::int as n from research_run_videos where is_high_potential
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
