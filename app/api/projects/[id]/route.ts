import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const niche = typeof body.niche === 'string' ? body.niche.trim() : undefined;
  const audience = typeof body.audience === 'string' ? body.audience.trim() : undefined;
  const voice = typeof body.voice === 'string' ? body.voice.trim() : undefined;
  const description = typeof body.description === 'string' ? body.description.trim() : undefined;
  const language = typeof body.default_language === 'string' ? body.default_language.trim() : undefined;
  const archived = typeof body.archived === 'boolean' ? body.archived : undefined;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((item): item is string => typeof item === 'string')
    : undefined;
  try {
    const sql = getDb();
    const rows = await sql`
      update projects set
        name = coalesce(${name ?? null}, name),
        niche = coalesce(${niche ?? null}, niche),
        audience = coalesce(${audience ?? null}, audience),
        voice = coalesce(${voice ?? null}, voice),
        description = coalesce(${description ?? null}, description),
        default_language = coalesce(${language ?? null}, default_language),
        platforms = coalesce(${platforms ? sql.array(platforms) : null}, platforms),
        viral_score_config = coalesce(${body.viral_score_config && typeof body.viral_score_config === 'object' ? sql.json(body.viral_score_config as never) : null}, viral_score_config),
        archived_at = case
          when ${archived === true} then coalesce(archived_at, now())
          when ${archived === false} then null
          else archived_at
        end
      where id = ${params.id}
      returning id, slug, name, niche, audience, voice, platforms, archived_at
    `;
    if (!rows[0]) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project: rows[0] });
  } catch (err) {
    console.error('[projects] update failed', err);
    return NextResponse.json({ error: 'Could not update project' }, { status: 500 });
  }
}
