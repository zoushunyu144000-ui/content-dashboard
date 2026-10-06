import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDERS = new Set(['apify', 'tikhub', 'youtube', 'auto']);

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (projectId && !UUID.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }
  try {
    const sql = getDb();
    const runs = projectId
      ? await sql`
          select id, project_id, topic, status, current_step, progress, error_message,
                 scraper_provider, scraper_note, started_at, completed_at, created_at
          from research_runs
          where project_id = ${projectId}
          order by created_at desc
          limit 50
        `
      : await sql`
          select id, project_id, topic, status, current_step, progress, error_message,
                 scraper_provider, scraper_note, started_at, completed_at, created_at
          from research_runs
          order by created_at desc
          limit 50
        `;
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[runs] list failed', err);
    return NextResponse.json({ error: 'Could not load research runs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let body: { projectId?: unknown; topic?: unknown; scraperProvider?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!UUID.test(projectId)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
  const requested = typeof body.scraperProvider === 'string' ? body.scraperProvider : '';
  const scraperProvider = PROVIDERS.has(requested) ? requested : undefined;
  try {
    const sql = getDb();
    const active = await sql<{ id: string; status: string }[]>`
      select id, status from research_runs
      where project_id = ${projectId}
        and status not in ('completed', 'failed', 'cancelled')
      order by created_at
      limit 1
    `;
    if (active[0]) {
      return NextResponse.json({ id: active[0].id, status: active[0].status, existing: true });
    }
    const config = scraperProvider ? { scraperProvider } : {};
    const created = await sql<{ id: string; status: string }[]>`
      insert into research_runs (project_id, topic, status, config, created_by)
      values (${projectId}, ${topic}, 'created', ${sql.json(config as never)}, ${auth.user.id})
      returning id, status
    `;
    await sql`
      insert into research_run_events (run_id, phase, message)
      values (${created[0].id}, 'created', ${'Run created'})
    `;
    return NextResponse.json({ id: created[0].id, status: created[0].status, existing: false }, { status: 201 });
  } catch (err) {
    console.error('[runs] create failed', err);
    return NextResponse.json({ error: 'Could not create research run' }, { status: 500 });
  }
}
