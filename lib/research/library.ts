import 'server-only';
import { getDb } from '@/lib/db';
import {
  ANALYSIS_ENUM_COLUMNS,
  AUDIENCE_CATEGORIES,
  CONTENT_FORMATS,
  CONTENT_STRUCTURES,
  CTA_TYPES,
  EMOTIONS,
  HOOK_TYPES,
  PAIN_POINT_CATEGORIES,
  TOPIC_CATEGORIES,
  type AnalysisEnumColumn,
} from '@/lib/research/taxonomy';

type Sql = ReturnType<typeof getDb>;

export class LibraryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryInputError';
  }
}

export type FrequencyWindow = 'run' | '7d' | '30d' | 'all';

export interface LibraryQuery {
  nicheId: string;
  platform?: string | null;
  audienceCategory?: string | null;
  painPointCategory?: string | null;
  topicCategory?: string | null;
  hookType?: string | null;
  emotion?: string | null;
  contentStructure?: string | null;
  contentFormat?: string | null;
  ctaType?: string | null;
  analyzed?: boolean | null;
  highPotential?: boolean | null;
  minViralScore?: number | null;
  limit?: number;
  offset?: number;
}

export interface LibraryVideo {
  id: string;
  platform: string;
  url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  author_handle: string | null;
  author_name: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  published_at: Date | string | null;
  viral_score: number | null;
  is_high_potential: boolean | null;
  analysis_status: string | null;
  analysis_error: string | null;
  audience: string | null;
  audience_category: string | null;
  pain_point: string | null;
  pain_point_category: string | null;
  topic: string | null;
  topic_category: string | null;
  hook: string | null;
  hook_type: string | null;
  emotion: string | null;
  content_structure: string | null;
  content_format: string | null;
  cta_type: string | null;
  why_it_works: string | null;
  what_not_to_copy: string | null;
  replicability_score: number | null;
  value_types: unknown;
  tags: string[] | null;
  viral_hypothesis: string | null;
  reusable_pattern: string | null;
  relevance: number | null;
  summary: string | null;
  prompt_version: string | null;
  analysis_version: string | null;
}

export interface FrequencyBucket {
  key: string;
  count: number;
  pct: number;
}

export interface CategoryFrequencies {
  niche_id: string;
  run_id: string | null;
  window: FrequencyWindow;
  video_count: number;
  analyzed_count: number;
  frequencies: Record<AnalysisEnumColumn, FrequencyBucket[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string, label: string): string {
  if (!UUID.test(value)) throw new LibraryInputError(`Invalid ${label}`);
  return value;
}

function requireKey(value: string | null | undefined, keys: readonly string[], label: string): string | null {
  if (value == null || value === '') return null;
  if (!keys.includes(value)) throw new LibraryInputError(`Invalid ${label}`);
  return value;
}

function enumColumn(sql: Sql, column: AnalysisEnumColumn) {
  switch (column) {
    case 'hook_type':
      return sql`a.hook_type`;
    case 'emotion':
      return sql`a.emotion`;
    case 'content_structure':
      return sql`a.content_structure`;
    case 'content_format':
      return sql`a.content_format`;
    case 'cta_type':
      return sql`a.cta_type`;
    case 'audience_category':
      return sql`a.audience_category`;
    case 'pain_point_category':
      return sql`a.pain_point_category`;
    case 'topic_category':
      return sql`a.topic_category`;
    default: {
      const unknown: never = column;
      throw new LibraryInputError(`Invalid column ${unknown}`);
    }
  }
}

export async function listLibrary(query: LibraryQuery): Promise<LibraryVideo[]> {
  const nicheId = requireUuid(query.nicheId, 'niche id');
  const platform = query.platform?.trim() || null;
  const audienceCategory = requireKey(query.audienceCategory, AUDIENCE_CATEGORIES, 'audience_category');
  const painPointCategory = requireKey(query.painPointCategory, PAIN_POINT_CATEGORIES, 'pain_point_category');
  const topicCategory = requireKey(query.topicCategory, TOPIC_CATEGORIES, 'topic_category');
  const hookType = requireKey(query.hookType, HOOK_TYPES, 'hook_type');
  const emotion = requireKey(query.emotion, EMOTIONS, 'emotion');
  const contentStructure = requireKey(query.contentStructure, CONTENT_STRUCTURES, 'content_structure');
  const contentFormat = requireKey(query.contentFormat, CONTENT_FORMATS, 'content_format');
  const ctaType = requireKey(query.ctaType, CTA_TYPES, 'cta_type');
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const offset = Math.max(0, query.offset ?? 0);
  const minViralScore = query.minViralScore == null || !Number.isFinite(query.minViralScore) ? null : query.minViralScore;

  const sql = getDb();
  const rows = await sql<LibraryVideo[]>`
    with members as (
      select distinct video_id from (
        select rv.video_id
        from research_run_videos rv
        join research_runs r on r.id = rv.run_id
        where r.project_id = ${nicheId}
        union
        select a.video_id
        from video_analyses a
        where a.niche_id = ${nicheId}
      ) ids
    )
    select v.id, v.platform, v.url, v.thumbnail_url, v.caption, v.author_handle, v.author_name,
           v.views, v.likes, v.comments, v.shares, v.saves, v.published_at,
           s.viral_score, s.is_high_potential,
           a.status as analysis_status, a.error as analysis_error,
           a.audience, a.audience_category, a.pain_point, a.pain_point_category,
           a.topic, a.topic_category, a.hook, a.hook_type, a.emotion, a.content_structure,
           a.content_format, a.cta_type, a.why_it_works, a.what_not_to_copy, a.replicability_score,
           a.value_types, a.tags, a.viral_hypothesis, a.reusable_pattern, a.relevance, a.summary,
           a.prompt_version, a.analysis_version
    from members m
    join videos v on v.id = m.video_id
    left join lateral (
      select status, error, audience, audience_category, pain_point, pain_point_category,
             topic, topic_category, hook, hook_type, emotion, content_structure,
             content_format, cta_type, why_it_works, what_not_to_copy, replicability_score,
             value_types, tags, viral_hypothesis, reusable_pattern, relevance, summary,
             prompt_version, analysis_version
      from video_analyses
      where video_id = v.id and is_latest = true
      order by created_at desc
      limit 1
    ) a on true
    left join lateral (
      select rv.viral_score, rv.is_high_potential
      from research_run_videos rv
      join research_runs r on r.id = rv.run_id
      where rv.video_id = v.id and r.project_id = ${nicheId}
      order by rv.viral_score desc nulls last
      limit 1
    ) s on true
    where true
      ${platform ? sql`and v.platform = ${platform}` : sql``}
      ${audienceCategory ? sql`and a.audience_category = ${audienceCategory}` : sql``}
      ${painPointCategory ? sql`and a.pain_point_category = ${painPointCategory}` : sql``}
      ${topicCategory ? sql`and a.topic_category = ${topicCategory}` : sql``}
      ${hookType ? sql`and a.hook_type = ${hookType}` : sql``}
      ${emotion ? sql`and a.emotion = ${emotion}` : sql``}
      ${contentStructure ? sql`and a.content_structure = ${contentStructure}` : sql``}
      ${contentFormat ? sql`and a.content_format = ${contentFormat}` : sql``}
      ${ctaType ? sql`and a.cta_type = ${ctaType}` : sql``}
      ${query.analyzed === true ? sql`and a.status = 'complete'` : sql``}
      ${query.analyzed === false ? sql`and (a.status is null or a.status <> 'complete')` : sql``}
      ${query.highPotential === true ? sql`and s.is_high_potential = true` : sql``}
      ${query.highPotential === false ? sql`and (s.is_high_potential is null or s.is_high_potential = false)` : sql``}
      ${minViralScore != null ? sql`and s.viral_score >= ${minViralScore}` : sql``}
    order by s.viral_score desc nulls last, v.published_at desc nulls last
    limit ${limit}
    offset ${offset}
  `;
  return rows;
}

function percent(count: number, analyzed: number): number {
  if (analyzed <= 0 || count <= 0) return 0;
  return Math.round((count * 1000) / analyzed) / 10;
}

export async function categoryFrequencies(input: {
  nicheId: string;
  runId?: string | null;
  window: FrequencyWindow;
}): Promise<CategoryFrequencies> {
  const nicheId = requireUuid(input.nicheId, 'niche id');
  const window = input.window;
  if (window !== 'run' && window !== '7d' && window !== '30d' && window !== 'all') {
    throw new LibraryInputError('Invalid window');
  }
  const runId = input.runId ? requireUuid(input.runId, 'run id') : null;
  if (window === 'run' && !runId) throw new LibraryInputError('run window requires run_id');

  const sql = getDb();
  if (window === 'run' && runId) {
    const owned = await sql<{ id: string }[]>`
      select id from research_runs where id = ${runId} and project_id = ${nicheId} limit 1
    `;
    if (!owned[0]) throw new LibraryInputError('Research run was not found for this niche');
  }

  const source =
    window === 'run'
      ? sql`(
          select distinct on (video_id) *
          from video_analyses
          where run_id = ${runId}
            and status = 'complete'
            and (niche_id = ${nicheId} or niche_id is null)
          order by video_id, created_at desc
        ) a`
      : sql`video_analyses a`;
  const nicheFilter =
    window === 'run' ? sql`` : sql`and a.niche_id = ${nicheId} and a.is_latest = true and a.status = 'complete'`;
  const timeFilter =
    window === '7d'
      ? sql`and v.published_at >= now() - interval '7 days'`
      : window === '30d'
        ? sql`and v.published_at >= now() - interval '30 days'`
        : sql``;

  const videoCountRows =
    window === 'run'
      ? await sql<{ n: number }[]>`
          select count(*)::int as n from research_run_videos where run_id = ${runId}
        `
      : await sql<{ n: number }[]>`
          select count(distinct video_id)::int as n from (
            select rv.video_id, v.published_at
            from research_run_videos rv
            join research_runs r on r.id = rv.run_id
            join videos v on v.id = rv.video_id
            where r.project_id = ${nicheId}
            union
            select a.video_id, v.published_at
            from video_analyses a
            join videos v on v.id = a.video_id
            where a.niche_id = ${nicheId}
          ) members
          where ${window === 'all' ? sql`true` : window === '7d' ? sql`published_at >= now() - interval '7 days'` : sql`published_at >= now() - interval '30 days'`}
        `;

  const analyzedRows = await sql<{ n: number }[]>`
    select count(*)::int as n
    from ${source}
    join videos v on v.id = a.video_id
    where a.status = 'complete'
      ${nicheFilter}
      ${timeFilter}
  `;
  const analyzed = Number(analyzedRows[0]?.n || 0);
  const frequencies = {} as Record<AnalysisEnumColumn, FrequencyBucket[]>;

  for (const column of ANALYSIS_ENUM_COLUMNS) {
    const expr = enumColumn(sql, column);
    const grouped = await sql<{ key: string; count: number }[]>`
      select ${expr} as key, count(*)::int as count
      from ${source}
      join videos v on v.id = a.video_id
      where a.status = 'complete'
        ${nicheFilter}
        ${timeFilter}
        and ${expr} is not null
      group by 1
      order by count(*) desc, 1
    `;
    frequencies[column] = grouped
      .filter((row) => row.key)
      .map((row) => ({
        key: row.key,
        count: Number(row.count) || 0,
        pct: percent(Number(row.count) || 0, analyzed),
      }));
  }

  return {
    niche_id: nicheId,
    run_id: window === 'run' ? runId : null,
    window,
    video_count: Number(videoCountRows[0]?.n || 0),
    analyzed_count: analyzed,
    frequencies,
  };
}
