import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { generateIdeas } from '@/lib/research/ideas';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const sql = getDb();
    const ideas = await sql`
      select id, position, topic, hook, angle, structure, reason, model, created_at
      from research_content_ideas
      where run_id = ${params.id}
      order by position
    `;
    return NextResponse.json({ ideas });
  } catch (err) {
    console.error('[ideas] list failed', err);
    return NextResponse.json({ error: 'Could not load ideas' }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });
  try {
    const result = await generateIdeas(params.id);
    const sql = getDb();
    const ideas = await sql`
      select id, position, topic, hook, angle, structure, reason, model, created_at
      from research_content_ideas
      where run_id = ${params.id}
      order by position
    `;
    return NextResponse.json({ count: result.count, ideas });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate ideas';
    const status = /not found/i.test(message) ? 404 : /completed/i.test(message) ? 409 : 500;
    if (status === 500) console.error('[ideas] generate failed', err);
    return NextResponse.json({ error: message }, { status });
  }
}
