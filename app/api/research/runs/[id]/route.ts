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
      select id, project_id, topic, status, current_step, progress, error_message,
             scraper_provider, scraper_note, insights, config, attempts, max_attempts,
             started_at, completed_at, created_at, updated_at
      from research_runs
      where id = ${params.id}
      limit 1
    `;
    if (!runs[0]) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    const events = await sql`
      select id, phase, message, created_at
      from research_run_events
      where run_id = ${params.id}
      order by created_at desc
      limit 40
    `;
    return NextResponse.json({ run: runs[0], events });
  } catch (err) {
    console.error('[runs] read failed', err);
    return NextResponse.json({ error: 'Could not load research run' }, { status: 500 });
  }
}
