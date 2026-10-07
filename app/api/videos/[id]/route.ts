import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });
  try {
    const sql = getDb();
    const videos = await sql`
      select id, platform, platform_video_id, url, canonical_url, video_url, video_url_expires_at,
             embed_url, thumbnail_url, caption, author_handle, author_name, author_followers,
             views, likes, comments, shares, saves, duration_seconds, published_at, transcript,
             first_seen_at, last_seen_at
      from videos
      where id = ${params.id}
      limit 1
    `;
    const video = videos[0];
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const analyses = await sql`
      select id, run_id, video_id, niche_id,
             audience, audience_category, pain_point, pain_point_category,
             hook, hook_type, emotion, topic, topic_category,
             content_structure, content_format, cta_type,
             why_it_works, what_not_to_copy,
             viral_hypothesis, reusable_pattern,
             replicability, replicability_score, relevance, relevance_reason,
             hook_text, summary, value_types, tags,
             model, prompt_version, analysis_version,
             status, error, is_latest, created_at
      from video_analyses
      where video_id = ${params.id} and is_latest = true
      order by created_at desc
      limit 1
    `;
    const history = await sql`
      select id, model, prompt_version, status, error, created_at
      from video_analyses
      where video_id = ${params.id}
      order by created_at desc
    `;
    const scores = await sql<{ viral_score: number | null; is_high_potential: boolean | null }[]>`
      select max(viral_score)::float8 as viral_score,
             bool_or(is_high_potential) as is_high_potential
      from research_run_videos
      where video_id = ${params.id}
    `;
    const score = scores[0];
    return NextResponse.json({
      video,
      analysis: analyses[0] ?? null,
      history,
      viral_score: score?.viral_score ?? null,
      is_high_potential: score?.is_high_potential ?? null,
    });
  } catch (err) {
    console.error('[videos] detail failed', err);
    return NextResponse.json({ error: 'Could not load video' }, { status: 500 });
  }
}
