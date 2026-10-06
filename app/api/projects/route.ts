import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'project';
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getDb();
    const projects = await sql`
      select id, slug, name, description, niche, audience, voice, platforms, default_language,
             viral_score_config, created_at, updated_at, archived_at
      from projects
      where archived_at is null
      order by name
    `;
    return NextResponse.json({ projects });
  } catch (err) {
    console.error('[projects] list failed', err);
    return NextResponse.json({ error: 'Could not load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let body: { name?: unknown; slug?: unknown; niche?: unknown; audience?: unknown; platforms?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const slug = typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(name);
  const niche = typeof body.niche === 'string' ? body.niche.trim() : null;
  const audience = typeof body.audience === 'string' ? body.audience.trim() : null;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : ['tiktok'];
  try {
    const sql = getDb();
    const rows = await sql`
      insert into projects (slug, name, niche, audience, platforms)
      values (${slug}, ${name}, ${niche}, ${audience}, ${sql.array(platforms.length ? platforms : ['tiktok'])})
      returning id, slug, name
    `;
    return NextResponse.json({ project: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[projects] create failed', err);
    return NextResponse.json({ error: 'Could not create project' }, { status: 500 });
  }
}
