import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const sql = getDb();
    const rows = await sql`
      update research_runs
      set status = 'cancelled', current_step = 'cancelled', completed_at = now(),
          locked_at = null, locked_by = null
      where id = ${params.id}
        and status not in ('completed', 'failed', 'cancelled')
      returning id, status
    `;
    if (!rows[0]) return NextResponse.json({ error: 'Run cannot be cancelled' }, { status: 409 });
    await sql`
      insert into research_run_events (run_id, phase, message)
      values (${params.id}, 'cancelled', ${'Cancelled by user'})
    `;
    return NextResponse.json({ id: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error('[runs] cancel failed', err);
    return NextResponse.json({ error: 'Could not cancel research run' }, { status: 500 });
  }
}
