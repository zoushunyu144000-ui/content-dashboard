import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';
import { type AnalysisEnumColumn } from '@/lib/research/taxonomy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Sql = ReturnType<typeof getDb>;

const FACET_COLUMNS = [
  'audience_category',
  'pain_point_category',
  'topic_category',
  'hook_type',
  'emotion',
  'content_structure',
  'content_format',
  'cta_type',
] as const satisfies readonly AnalysisEnumColumn[];

function columnExpr(sql: Sql, column: (typeof FACET_COLUMNS)[number]) {
  switch (column) {
    case 'audience_category':
      return sql`audience_category`;
    case 'pain_point_category':
      return sql`pain_point_category`;
    case 'topic_category':
      return sql`topic_category`;
    case 'hook_type':
      return sql`hook_type`;
    case 'emotion':
      return sql`emotion`;
    case 'content_structure':
      return sql`content_structure`;
    case 'content_format':
      return sql`content_format`;
    case 'cta_type':
      return sql`cta_type`;
    default: {
      const unknown: never = column;
      throw new Error(`Invalid column ${unknown}`);
    }
  }
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const niche = new URL(request.url).searchParams.get('niche')?.trim() || '';
  if (!niche) return NextResponse.json({ error: 'niche is required' }, { status: 400 });
  if (!UUID.test(niche)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });

  try {
    const sql = getDb();
    const facets = {} as Record<(typeof FACET_COLUMNS)[number], { key: string; count: number }[]>;
    for (const column of FACET_COLUMNS) {
      const expr = columnExpr(sql, column);
      const rows = await sql<{ key: string; count: number }[]>`
        select ${expr} as key, count(*)::int as count
        from video_analyses
        where niche_id = ${niche}
          and is_latest = true
          and status = 'complete'
          and ${expr} is not null
        group by 1
        order by count(*) desc, 1
      `;
      facets[column] = rows.filter((row) => row.key).map((row) => ({ key: row.key, count: Number(row.count) || 0 }));
    }
    return NextResponse.json(facets);
  } catch (err) {
    console.error('[library] facets failed', err);
    return NextResponse.json({ error: 'Could not load facets' }, { status: 500 });
  }
}
