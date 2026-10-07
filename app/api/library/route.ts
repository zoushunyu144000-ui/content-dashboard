import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { LibraryInputError, listLibrary } from '@/lib/research/library';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function param(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: string | null): number | undefined | null {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const niche = param(url, 'niche');
  if (!niche) return NextResponse.json({ error: 'niche is required' }, { status: 400 });
  if (!UUID.test(niche)) return NextResponse.json({ error: 'Invalid niche id' }, { status: 400 });

  const analyzedRaw = param(url, 'analyzed');
  let analyzed: boolean | null = null;
  if (analyzedRaw === 'yes') analyzed = true;
  else if (analyzedRaw === 'no') analyzed = false;
  else if (analyzedRaw) return NextResponse.json({ error: 'Invalid analyzed' }, { status: 400 });

  const minViralScore = readNumber(param(url, 'min_score'));
  if (minViralScore === null) return NextResponse.json({ error: 'Invalid min_score' }, { status: 400 });
  const limit = readNumber(param(url, 'limit'));
  if (limit === null) return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  const offset = readNumber(param(url, 'offset'));
  if (offset === null) return NextResponse.json({ error: 'Invalid offset' }, { status: 400 });

  try {
    const videos = await listLibrary({
      nicheId: niche,
      platform: param(url, 'platform'),
      audienceCategory: param(url, 'audience_category'),
      painPointCategory: param(url, 'pain_point_category'),
      topicCategory: param(url, 'topic_category'),
      hookType: param(url, 'hook_type'),
      emotion: param(url, 'emotion'),
      contentStructure: param(url, 'content_structure'),
      contentFormat: param(url, 'content_format'),
      ctaType: param(url, 'cta_type'),
      analyzed,
      highPotential: param(url, 'high_potential') === '1' ? true : null,
      minViralScore,
      limit,
      offset,
    });
    return NextResponse.json({ videos });
  } catch (err) {
    if (err instanceof LibraryInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[library] list failed', err);
    return NextResponse.json({ error: 'Could not load library' }, { status: 500 });
  }
}
