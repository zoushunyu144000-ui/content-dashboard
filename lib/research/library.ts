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
  VALUE_LEVELS,
  VALUE_TYPES,
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

export type FrequencyPeriod = 'current' | 'previous';

export interface CategoryFrequencies {
  niche_id: string;
  run_id: string | null;
  window: FrequencyWindow;
  video_count: number;
  analyzed_count: number;
  frequencies: Record<AnalysisEnumColumn, FrequencyBucket[]> & {
    tags: FrequencyBucket[];
    value_types: Record<string, FrequencyBucket[]>;
  };
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

function memberSeenFilter(sql: Sql, window: FrequencyWindow, period: FrequencyPeriod) {
  if (window === '7d' && period === 'previous') {
    return sql`first_seen_at >= now() - interval '14 days' and first_seen_at < now() - interval '7 days'`;
  }
  if (window === '7d') return sql`first_seen_at >= now() - interval '7 days'`;
  if (window === '30d' && period === 'previous') {
    return sql`first_seen_at >= now() - interval '60 days' and first_seen_at < now() - interval '30 days'`;
  }
  if (window === '30d') return sql`first_seen_at >= now() - interval '30 days'`;
  return sql`true`;
}

function analysisSeenFilter(sql: Sql, window: FrequencyWindow, period: FrequencyPeriod) {
  if (window === '7d' && period === 'previous') {
    return sql`and v.first_seen_at >= now() - interval '14 days' and v.first_seen_at < now() - interval '7 days'`;
  }
  if (window === '7d') return sql`and v.first_seen_at >= now() - interval '7 days'`;
  if (window === '30d' && period === 'previous') {
    return sql`and v.first_seen_at >= now() - interval '60 days' and v.first_seen_at < now() - interval '30 days'`;
  }
  if (window === '30d') return sql`and v.first_seen_at >= now() - interval '30 days'`;
  return sql``;
}

function valueTypeFrequencies(
  rows: { type_key: string; level: string; count: number }[],
  analyzed: number,
): Record<string, FrequencyBucket[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!row.type_key || !row.level) continue;
    const levels = counts.get(row.type_key) ?? new Map<string, number>();
    levels.set(row.level, Number(row.count) || 0);
    counts.set(row.type_key, levels);
  }
  const types = VALUE_TYPES.map(String);
  for (const type of Array.from(counts.keys())) {
    if (!types.includes(type)) types.push(type);
  }
  const out: Record<string, FrequencyBucket[]> = {};
  for (const type of types) {
    const levels = counts.get(type) ?? new Map<string, number>();
    const order = VALUE_LEVELS.map(String);
    for (const level of Array.from(levels.keys())) {
      if (!order.includes(level)) order.push(level);
    }
    out[type] = order.map((level) => {
      const count = levels.get(level) ?? 0;
      return { key: level, count, pct: percent(count, analyzed) };
    });
  }
  return out;
}

export async function categoryFrequencies(input: {
  nicheId: string;
  runId?: string | null;
  window: FrequencyWindow;
  period?: FrequencyPeriod;
}): Promise<CategoryFrequencies> {
  const nicheId = requireUuid(input.nicheId, 'niche id');
  const window = input.window;
  if (window !== 'run' && window !== '7d' && window !== '30d' && window !== 'all') {
    throw new LibraryInputError('Invalid window');
  }
  const period = input.period === 'previous' ? 'previous' : 'current';
  if (period === 'previous' && window !== '7d' && window !== '30d') {
    throw new LibraryInputError('previous period is only available for 7d and 30d');
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
          select distinct on (a.video_id) a.*
          from research_run_videos rv
          join video_analyses a on a.video_id = rv.video_id
          where rv.run_id = ${runId}
            and a.is_latest = true
            and a.status = 'complete'
            and a.niche_id = ${nicheId}
          order by a.video_id, a.created_at desc
        ) a`
      : sql`video_analyses a`;
  const nicheFilter =
    window === 'run' ? sql`` : sql`and a.niche_id = ${nicheId} and a.is_latest = true and a.status = 'complete'`;
  const timeFilter = analysisSeenFilter(sql, window, period);

  const videoCountRows =
    window === 'run'
      ? await sql<{ n: number }[]>`
          select count(*)::int as n from research_run_videos where run_id = ${runId}
        `
      : await sql<{ n: number }[]>`
          select count(distinct video_id)::int as n from (
            select rv.video_id, v.first_seen_at
            from research_run_videos rv
            join research_runs r on r.id = rv.run_id
            join videos v on v.id = rv.video_id
            where r.project_id = ${nicheId}
            union
            select a.video_id, v.first_seen_at
            from video_analyses a
            join videos v on v.id = a.video_id
            where a.niche_id = ${nicheId}
          ) members
          where ${memberSeenFilter(sql, window, period)}
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
  const frequencies = {} as CategoryFrequencies['frequencies'];

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

  const tagRows = await sql<{ key: string; count: number }[]>`
    select tag as key, count(*)::int as count
    from ${source}
    join videos v on v.id = a.video_id
    cross join lateral unnest(coalesce(a.tags, '{}')) as tag
    where a.status = 'complete'
      ${nicheFilter}
      ${timeFilter}
      and tag <> ''
    group by 1
    order by count(*) desc, 1
    limit 20
  `;
  frequencies.tags = tagRows
    .filter((row) => row.key)
    .map((row) => ({
      key: row.key,
      count: Number(row.count) || 0,
      pct: percent(Number(row.count) || 0, analyzed),
    }));

  const valueRows = await sql<{ type_key: string; level: string; count: number }[]>`
    select vt.type_key, vt.level, count(*)::int as count
    from ${source}
    join videos v on v.id = a.video_id
    cross join lateral jsonb_each_text(
      case when jsonb_typeof(a.value_types) = 'object' then a.value_types else '{}'::jsonb end
    ) as vt(type_key, level)
    where a.status = 'complete'
      ${nicheFilter}
      ${timeFilter}
      and vt.level <> ''
    group by 1, 2
  `;
  frequencies.value_types = valueTypeFrequencies(valueRows, analyzed);

  return {
    niche_id: nicheId,
    run_id: window === 'run' ? runId : null,
    window,
    video_count: Number(videoCountRows[0]?.n || 0),
    analyzed_count: analyzed,
    frequencies,
  };
}
