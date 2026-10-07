import 'server-only';
import { getDb } from '@/lib/db';
import { getAIProvider } from '@/lib/research/ai/provider';
import type { JsonSchema } from '@/lib/research/ai/schema';
import { PROMPT_VERSION as ANALYSIS_PROMPT } from '@/lib/research/ai/tasks/video-analysis';
import {
  CONTENT_STRUCTURES,
  CONTENT_STRUCTURE_LABELS,
  HOOK_TYPES,
  HOOK_TYPE_LABELS,
  OPPORTUNITY_TYPES,
  PAIN_POINT_CATEGORIES,
  PAIN_POINT_CATEGORY_LABELS,
  TOPIC_CATEGORIES,
  TOPIC_CATEGORY_LABELS,
} from '@/lib/research/taxonomy';

type Sql = ReturnType<typeof getDb>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ARRAY_OID = 2951;
const PROMPT_VERSION = 'opp-v1';

const DIMENSIONS = ['pain_point_category', 'topic_category', 'hook_type', 'content_structure'] as const;
type Dimension = (typeof DIMENSIONS)[number];

export class OpportunityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpportunityInputError';
  }
}

export class OpportunityNicheNotFoundError extends Error {
  constructor() {
    super('Niche was not found');
    this.name = 'OpportunityNicheNotFoundError';
  }
}

export interface OpportunityMatch {
  pain_point_category: string;
  topic_category: string;
  hook_type: string;
}

export interface OpportunityEvidence {
  matching_videos: number;
  high_potential: number;
  avg_viral_score: number | null;
  outlier_3x: number;
  outlier_8x: number;
  total_views: number;
  criteria: OpportunityMatch;
}

export interface Opportunity {
  id: string;
  niche_id: string;
  run_id: string | null;
  title: string;
  topic: string | null;
  target_audience: string | null;
  pain_point: string | null;
  recommended_hook: string | null;
  angle: string | null;
  content_structure: string | null;
  why_now: string | null;
  opportunity_type: string | null;
  platform_suggestion: string | null;
  evidence: OpportunityEvidence | null;
  evidence_video_ids: string[];
  ai_task_run_id: string | null;
  status: string;
  created_at: Date | string;
}

export interface OpportunityVideo {
  id: string;
  caption: string | null;
  author_handle: string | null;
  thumbnail_url: string | null;
  url: string | null;
  views: number | null;
  viral_score: number | null;
  pain_point: string | null;
  hook_type: string | null;
}

export interface FrequencyStat {
  key: string;
  count: number;
  avg_viral_score: number | null;
}

export interface DashboardBucket {
  key: string;
  count: number;
  pct: number;
}

export interface NicheDashboard {
  niche: { id: string; name: string };
  week: { videos_discovered: number; high_potential: number; opportunities: number };
  totals: { videos: number; analyzed: number };
  trending_pain_point: DashboardBucket | null;
  best_hook: { key: string; count: number; avg_viral_score: number } | null;
  emerging_topic: { key: string; count: number } | null;
  recommended: Opportunity | null;
  top_pain_points: DashboardBucket[];
  top_hooks: DashboardBucket[];
  top_topics: DashboardBucket[];
  recent_viral: {
    id: string;
    caption: string | null;
    thumbnail_url: string | null;
    author_handle: string | null;
    views: number | null;
    viral_score: number | null;
    hook_type: string | null;
  }[];
}

interface NicheProfileRow {
  id: string;
  name: string;
  target_audience: string | null;
  core_business: string | null;
  content_goal: string | null;
  core_pain_points: string[] | null;
}

interface OpportunityRow {
  id: string;
  niche_id: string;
  run_id: string | null;
  title: string;
  topic: string | null;
  target_audience: string | null;
  pain_point: string | null;
  recommended_hook: string | null;
  angle: string | null;
  content_structure: string | null;
  why_now: string | null;
  opportunity_type: string | null;
  platform_suggestion: string | null;
  evidence: OpportunityEvidence | null;
  evidence_video_ids: string[] | null;
  ai_task_run_id: string | null;
  status: string;
  created_at: Date | string;
}

interface Draft {
  title: string;
  topic: string;
  target_audience: string;
  pain_point: string;
  recommended_hook: string;
  angle: string;
  content_structure: string;
  why_now: string;
  opportunity_type: string;
  platform_suggestion: string;
  match: OpportunityMatch;
  video_ids: string[];
}

interface StatRow {
  dimension: string;
  key: string;
  count: number;
  avg_viral_score: number | null;
}

interface EvidenceRow {
  matching_videos: number;
  high_potential: number;
  avg_viral_score: number | null;
  outlier_3x: number;
  outlier_8x: number;
  total_views: number | string | null;
  evidence_video_ids: string[] | null;
}

const TOPIC_OR_EMPTY = [...TOPIC_CATEGORIES, 'any'] as const;
const HOOK_OR_EMPTY = [...HOOK_TYPES, 'any'] as const;

const OPPORTUNITY_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['opportunities'],
  properties: {
    opportunities: {
      type: 'array',
      minItems: 6,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'topic',
          'target_audience',
          'pain_point',
          'recommended_hook',
          'angle',
          'content_structure',
          'why_now',
          'opportunity_type',
          'platform_suggestion',
          'match',
          'video_ids',
        ],
        properties: {
          title: { type: 'string', minLength: 1 },
          topic: { type: 'string', minLength: 1 },
          target_audience: { type: 'string', minLength: 1 },
          pain_point: { type: 'string', minLength: 1 },
          recommended_hook: { type: 'string', minLength: 1 },
          angle: { type: 'string', minLength: 1 },
          content_structure: { type: 'string', enum: CONTENT_STRUCTURES },
          why_now: { type: 'string', minLength: 1 },
          opportunity_type: { type: 'string', enum: OPPORTUNITY_TYPES },
          platform_suggestion: { type: 'string', minLength: 1 },
          match: {
            type: 'object',
            additionalProperties: false,
            required: ['pain_point_category', 'topic_category', 'hook_type'],
            properties: {
              pain_point_category: { type: 'string', enum: PAIN_POINT_CATEGORIES },
              topic_category: { type: 'string', enum: TOPIC_OR_EMPTY },
              hook_type: { type: 'string', enum: HOOK_OR_EMPTY },
            },
          },
          video_ids: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
};

const OPPORTUNITY_SYSTEM = `你是短视频内容策略顾问。只返回 JSON。
自由文本全部使用简体中文。枚举字段必须使用 schema 里的英文 key，不要写中文标签。
pain_point_category 必须是枚举值。topic_category 和 hook_type 可以是枚举值；没有把握时用 any。
video_ids 只能使用输入视频的 id，不要编造。
给出 6 到 8 条接下来就能拍的内容机会。每条都要写清痛点、钩子和角度，并优先使用频率统计里真实出现过的分类。
content_structure 和 opportunity_type 必须是枚举值。`;

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new OpportunityInputError(`Invalid ${label}`);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round1(value: unknown): number | null {
  const parsed = num(value);
  if (parsed == null) return null;
  return Math.round(parsed * 10) / 10;
}

function percent(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count * 1000) / total) / 10;
}

function enumKey(value: unknown, keys: readonly string[]): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return keys.includes(key) ? key : null;
}

function enumOrBlank(value: unknown, keys: readonly string[]): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (!key || key === 'any') return '';
  return keys.includes(key) ? key : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && UUID.test(item));
}

function isDimension(value: string): value is Dimension {
  return (DIMENSIONS as readonly string[]).includes(value);
}

function toOpportunity(row: OpportunityRow): Opportunity {
  const evidence = row.evidence && typeof row.evidence === 'object' ? row.evidence : null;
  return {
    id: row.id,
    niche_id: row.niche_id,
    run_id: row.run_id,
    title: row.title,
    topic: row.topic,
    target_audience: row.target_audience,
    pain_point: row.pain_point,
    recommended_hook: row.recommended_hook,
    angle: row.angle,
    content_structure: row.content_structure,
    why_now: row.why_now,
    opportunity_type: row.opportunity_type,
    platform_suggestion: row.platform_suggestion,
    evidence,
    evidence_video_ids: uuidList(row.evidence_video_ids),
    ai_task_run_id: row.ai_task_run_id,
    status: row.status,
    created_at: row.created_at,
  };
}

function scoresCte(sql: Sql, nicheId: string) {
  return sql`scores as (
    select distinct on (rv.video_id)
      rv.video_id,
      rv.viral_score,
      rv.is_high_potential,
      case
        when jsonb_typeof(rv.score_components->'outlierRatio') = 'number'
        then (rv.score_components->>'outlierRatio')::numeric
        else null
      end as outlier_ratio
    from research_run_videos rv
    join research_runs r on r.id = rv.run_id
    where r.project_id = ${nicheId}
    order by rv.video_id, rv.viral_score desc nulls last, rv.id
  )`;
}

function latestCte(sql: Sql, nicheId: string) {
  return sql`latest as (
    select distinct on (a.video_id)
      a.video_id,
      a.pain_point,
      a.topic,
      a.hook,
      a.hook_type,
      a.why_it_works,
      a.tags,
      a.pain_point_category,
      a.topic_category,
      a.content_structure
    from video_analyses a
    where a.niche_id = ${nicheId}
      and a.is_latest = true
      and a.status = 'complete'
      and a.prompt_version = ${ANALYSIS_PROMPT}
    order by a.video_id, a.created_at desc, a.id desc
  )`;
}

function membersCte(sql: Sql, nicheId: string) {
  return sql`members as (
    select v.id, v.caption, v.thumbnail_url, v.author_handle, v.url, v.views,
           v.published_at, v.first_seen_at
    from videos v
    where v.id in (
      select rv.video_id
      from research_run_videos rv
      join research_runs r on r.id = rv.run_id
      where r.project_id = ${nicheId}
      union
      select a.video_id
      from video_analyses a
      where a.niche_id = ${nicheId}
    )
  )`;
}

async function loadProfile(sql: Sql, nicheId: string): Promise<NicheProfileRow | null> {
  const rows = await sql<NicheProfileRow[]>`
    select id, name, target_audience, core_business, content_goal, core_pain_points
    from projects
    where id = ${nicheId}
    limit 1
  `;
  return rows[0] ?? null;
}

async function loadStats(sql: Sql, nicheId: string): Promise<Record<Dimension, FrequencyStat[]>> {
  const rows = await sql<StatRow[]>`
    with ${scoresCte(sql, nicheId)},
         ${latestCte(sql, nicheId)}
    select 'pain_point_category' as dimension, a.pain_point_category as key,
           count(*)::int as count,
           round(avg(s.viral_score)::numeric, 1)::float8 as avg_viral_score
    from latest a
    left join scores s on s.video_id = a.video_id
    where a.pain_point_category is not null and a.pain_point_category <> ''
    group by a.pain_point_category
    union all
    select 'topic_category', a.topic_category, count(*)::int,
           round(avg(s.viral_score)::numeric, 1)::float8
    from latest a
    left join scores s on s.video_id = a.video_id
    where a.topic_category is not null and a.topic_category <> ''
    group by a.topic_category
    union all
    select 'hook_type', a.hook_type, count(*)::int,
           round(avg(s.viral_score)::numeric, 1)::float8
    from latest a
    left join scores s on s.video_id = a.video_id
    where a.hook_type is not null and a.hook_type <> ''
    group by a.hook_type
    union all
    select 'content_structure', a.content_structure, count(*)::int,
           round(avg(s.viral_score)::numeric, 1)::float8
    from latest a
    left join scores s on s.video_id = a.video_id
    where a.content_structure is not null and a.content_structure <> ''
    group by a.content_structure
  `;
  const grouped: Record<Dimension, FrequencyStat[]> = {
    pain_point_category: [],
    topic_category: [],
    hook_type: [],
    content_structure: [],
  };
  for (const row of rows) {
    if (!isDimension(row.dimension) || !row.key) continue;
    grouped[row.dimension].push({
      key: row.key,
      count: Number(row.count) || 0,
      avg_viral_score: round1(row.avg_viral_score),
    });
  }
  for (const dimension of DIMENSIONS) {
    grouped[dimension].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
  return grouped;
}

function normalizeDraft(draft: Draft, allowedIds: Set<string>): {
  title: string;
  topic: string;
  target_audience: string;
  pain_point: string;
  recommended_hook: string;
  angle: string;
  content_structure: string;
  why_now: string;
  opportunity_type: string;
  platform_suggestion: string;
  match: OpportunityMatch;
  videoIds: string[];
} | null {
  const contentStructure = enumKey(draft.content_structure, CONTENT_STRUCTURES);
  const opportunityType = enumKey(draft.opportunity_type, OPPORTUNITY_TYPES);
  const pain = enumKey(draft.match?.pain_point_category, PAIN_POINT_CATEGORIES);
  const topic = enumOrBlank(draft.match?.topic_category, TOPIC_CATEGORIES);
  const hook = enumOrBlank(draft.match?.hook_type, HOOK_TYPES);
  const title = text(draft.title);
  if (!contentStructure || !opportunityType || !pain || topic == null || hook == null || !title) return null;
  const videoIds: string[] = [];
  for (const id of draft.video_ids || []) {
    if (typeof id !== 'string') continue;
    const normalized = id.trim().toLowerCase();
    if (!UUID.test(normalized) || !allowedIds.has(normalized) || videoIds.includes(normalized)) continue;
    videoIds.push(normalized);
  }
  return {
    title,
    topic: text(draft.topic),
    target_audience: text(draft.target_audience),
    pain_point: text(draft.pain_point),
    recommended_hook: text(draft.recommended_hook),
    angle: text(draft.angle),
    content_structure: contentStructure,
    why_now: text(draft.why_now),
    opportunity_type: opportunityType,
    platform_suggestion: text(draft.platform_suggestion),
    match: { pain_point_category: pain, topic_category: topic, hook_type: hook },
    videoIds,
  };
}

async function evidenceFor(
  sql: Sql,
  nicheId: string,
  match: OpportunityMatch,
  videoIds: string[],
): Promise<{ evidence: OpportunityEvidence; evidenceVideoIds: string[] } | null> {
  // Counts come from SQL. Model video ids only widen the set when they were in the prompt.
  const rows = await sql<EvidenceRow[]>`
    with ${scoresCte(sql, nicheId)},
         ${latestCte(sql, nicheId)},
         matched as (
           select a.video_id, s.viral_score, s.is_high_potential, s.outlier_ratio, v.views
           from latest a
           join videos v on v.id = a.video_id
           left join scores s on s.video_id = a.video_id
           where a.pain_point_category = ${match.pain_point_category}
             and (
               (${match.topic_category !== ''} and a.topic_category = ${match.topic_category})
               or (${match.hook_type !== ''} and a.hook_type = ${match.hook_type})
               or a.video_id = any(${sql.array(videoIds, UUID_ARRAY_OID)})
             )
         )
    select
      count(*)::int as matching_videos,
      count(*) filter (where is_high_potential)::int as high_potential,
      round(avg(viral_score)::numeric, 1)::float8 as avg_viral_score,
      count(*) filter (where outlier_ratio >= 3)::int as outlier_3x,
      count(*) filter (where outlier_ratio >= 8)::int as outlier_8x,
      coalesce(sum(views), 0)::float8 as total_views,
      coalesce(
        (
          select array_agg(video_id order by viral_score desc nulls last, video_id)
          from (
            select video_id, viral_score
            from matched
            order by viral_score desc nulls last, video_id
            limit 12
          ) top_videos
        ),
        '{}'::uuid[]
      ) as evidence_video_ids
    from matched
  `;
  const row = rows[0];
  const matching = Number(row?.matching_videos) || 0;
  if (!row || matching <= 0) return null;
  const evidenceVideoIds = uuidList(row.evidence_video_ids);
  return {
    evidenceVideoIds,
    evidence: {
      matching_videos: matching,
      high_potential: Number(row.high_potential) || 0,
      avg_viral_score: round1(row.avg_viral_score),
      outlier_3x: Number(row.outlier_3x) || 0,
      outlier_8x: Number(row.outlier_8x) || 0,
      total_views: num(row.total_views) ?? 0,
      criteria: match,
    },
  };
}

export async function generateOpportunities(nicheId: string): Promise<Opportunity[]> {
  assertUuid(nicheId, 'niche id');
  const sql = getDb();
  const [profile, frequencies, videoRows] = await Promise.all([
    loadProfile(sql, nicheId),
    loadStats(sql, nicheId),
    sql<{
      id: string;
      caption: string | null;
      views: number | string | null;
      viral_score: number | string | null;
      pain_point: string | null;
      topic: string | null;
      hook: string | null;
      hook_type: string | null;
      why_it_works: string | null;
      tags: string[] | null;
    }[]>`
      with ${scoresCte(sql, nicheId)},
           ${latestCte(sql, nicheId)}
      select v.id,
             left(v.caption, 150) as caption,
             v.views,
             s.viral_score::float8 as viral_score,
             a.pain_point,
             a.topic,
             a.hook,
             a.hook_type,
             left(a.why_it_works, 200) as why_it_works,
             coalesce(a.tags, '{}') as tags
      from latest a
      join videos v on v.id = a.video_id
      left join scores s on s.video_id = a.video_id
      order by s.viral_score desc nulls last, v.id
      limit 40
    `,
  ]);
  if (!profile) throw new OpportunityNicheNotFoundError();

  const videos = videoRows.map((row) => ({
    id: row.id,
    caption: row.caption,
    views: num(row.views),
    viral_score: num(row.viral_score),
    pain_point: row.pain_point,
    topic: row.topic,
    hook: row.hook,
    hook_type: row.hook_type,
    why_it_works: row.why_it_works,
    tags: row.tags ?? [],
  }));
  const allowedIds = new Set(videos.map((video) => video.id.toLowerCase()));

  const ai = getAIProvider('intel');
  const result = await ai.completeJson<{ opportunities: Draft[] }>({
    task: 'opportunities',
    system: OPPORTUNITY_SYSTEM,
    user: JSON.stringify({
      niche: {
        name: profile.name,
        target_audience: profile.target_audience,
        core_business: profile.core_business,
        content_goal: profile.content_goal,
        core_pain_points: profile.core_pain_points ?? [],
      },
      labels: {
        pain_point_category: PAIN_POINT_CATEGORY_LABELS,
        topic_category: TOPIC_CATEGORY_LABELS,
        hook_type: HOOK_TYPE_LABELS,
        content_structure: CONTENT_STRUCTURE_LABELS,
      },
      frequencies,
      videos,
    }),
    schemaName: 'opportunities',
    schema: OPPORTUNITY_SCHEMA,
    maxTokens: 12000,
    timeoutMs: 180000,
    promptVersion: PROMPT_VERSION,
    inputSource: { niche_id: nicheId },
  });

  const drafts = (result.data.opportunities || [])
    .map((draft) => normalizeDraft(draft, allowedIds))
    .filter((draft): draft is NonNullable<typeof draft> => draft != null);
  const evidenced = (
    await Promise.all(
      drafts.map(async (draft) => {
        const evidence = await evidenceFor(sql, nicheId, draft.match, draft.videoIds);
        if (!evidence) return null;
        return { draft, ...evidence };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item != null);

  const inserted = await sql.begin(async (tx) => {
    await tx`select id from projects where id = ${nicheId} for update`;
    await tx`
      update opportunities
      set status = 'superseded'
      where niche_id = ${nicheId} and status = 'active'
    `;
    const rows: OpportunityRow[] = [];
    for (const item of evidenced) {
      const created = await tx<OpportunityRow[]>`
        insert into opportunities (
          niche_id, run_id, title, topic, target_audience, pain_point, recommended_hook,
          angle, content_structure, why_now, opportunity_type, platform_suggestion,
          evidence, evidence_video_ids, ai_task_run_id, status
        ) values (
          ${nicheId},
          ${null},
          ${item.draft.title},
          ${item.draft.topic},
          ${item.draft.target_audience},
          ${item.draft.pain_point},
          ${item.draft.recommended_hook},
          ${item.draft.angle},
          ${item.draft.content_structure},
          ${item.draft.why_now},
          ${item.draft.opportunity_type},
          ${item.draft.platform_suggestion},
          ${tx.json(item.evidence as never)},
          ${tx.array(item.evidenceVideoIds, UUID_ARRAY_OID)},
          ${result.aiTaskRunId},
          'active'
        )
        returning id, niche_id, run_id, title, topic, target_audience, pain_point,
                  recommended_hook, angle, content_structure, why_now, opportunity_type,
                  platform_suggestion, evidence, evidence_video_ids, ai_task_run_id, status, created_at
      `;
      if (created[0]) rows.push(created[0]);
    }
    return rows;
  });
  return inserted.map(toOpportunity);
}

export async function listOpportunities(nicheId: string): Promise<Opportunity[]> {
  assertUuid(nicheId, 'niche id');
  const sql = getDb();
  const rows = await sql<OpportunityRow[]>`
    select id, niche_id, run_id, title, topic, target_audience, pain_point,
           recommended_hook, angle, content_structure, why_now, opportunity_type,
           platform_suggestion, evidence, evidence_video_ids, ai_task_run_id, status, created_at
    from opportunities
    where niche_id = ${nicheId} and status = 'active'
    order by coalesce((evidence->>'matching_videos')::numeric, 0) desc, created_at desc
  `;
  return rows.map(toOpportunity);
}

export async function getOpportunity(id: string): Promise<{ opportunity: Opportunity; videos: OpportunityVideo[] } | null> {
  assertUuid(id, 'opportunity id');
  const sql = getDb();
  const rows = await sql<OpportunityRow[]>`
    select id, niche_id, run_id, title, topic, target_audience, pain_point,
           recommended_hook, angle, content_structure, why_now, opportunity_type,
           platform_suggestion, evidence, evidence_video_ids, ai_task_run_id, status, created_at
    from opportunities
    where id = ${id}
    limit 1
  `;
  const opportunity = rows[0] ? toOpportunity(rows[0]) : null;
  if (!opportunity) return null;
  const ids = opportunity.evidence_video_ids;
  if (ids.length === 0) return { opportunity, videos: [] };
  const videos = await sql<{
    id: string;
    caption: string | null;
    author_handle: string | null;
    thumbnail_url: string | null;
    url: string | null;
    views: number | string | null;
    viral_score: number | string | null;
    pain_point: string | null;
    hook_type: string | null;
  }[]>`
    with ${scoresCte(sql, opportunity.niche_id)},
         ${latestCte(sql, opportunity.niche_id)}
    select v.id, v.caption, v.author_handle, v.thumbnail_url, v.url, v.views,
           s.viral_score::float8 as viral_score,
           a.pain_point, a.hook_type
    from unnest(${sql.array(ids, UUID_ARRAY_OID)}) with ordinality as picked(video_id, ord)
    join videos v on v.id = picked.video_id
    left join scores s on s.video_id = v.id
    left join latest a on a.video_id = v.id
    order by s.viral_score desc nulls last, picked.ord
  `;
  return {
    opportunity,
    videos: videos.map((video) => ({
      id: video.id,
      caption: video.caption,
      author_handle: video.author_handle,
      thumbnail_url: video.thumbnail_url,
      url: video.url,
      views: num(video.views),
      viral_score: num(video.viral_score),
      pain_point: video.pain_point,
      hook_type: video.hook_type,
    })),
  };
}

function buckets(stats: FrequencyStat[], analyzed: number, limit: number): DashboardBucket[] {
  return stats.slice(0, limit).map((stat) => ({
    key: stat.key,
    count: stat.count,
    pct: percent(stat.count, analyzed),
  }));
}

export async function getNicheDashboard(nicheId: string): Promise<NicheDashboard> {
  assertUuid(nicheId, 'niche id');
  const sql = getDb();
  const [profile, weekRows, analyzedRows, stats, topicRows, activeRows, recommendedRows, recentRows] = await Promise.all([
    loadProfile(sql, nicheId),
    sql<{ videos: number; videos_discovered: number; high_potential: number }[]>`
      with ${membersCte(sql, nicheId)},
           ${scoresCte(sql, nicheId)}
      select count(*)::int as videos,
             count(*) filter (where m.first_seen_at >= now() - interval '7 days')::int as videos_discovered,
             count(*) filter (
               where m.first_seen_at >= now() - interval '7 days' and coalesce(s.is_high_potential, false)
             )::int as high_potential
      from members m
      left join scores s on s.video_id = m.id
    `,
    sql<{ n: number }[]>`
      with ${latestCte(sql, nicheId)}
      select count(*)::int as n from latest
    `,
    loadStats(sql, nicheId),
    sql<{ key: string; recent_count: number; total_count: number }[]>`
      with ${latestCte(sql, nicheId)}
      select a.topic_category as key,
             count(*) filter (where v.published_at >= now() - interval '30 days')::int as recent_count,
             count(*)::int as total_count
      from latest a
      join videos v on v.id = a.video_id
      where a.topic_category is not null and a.topic_category <> ''
      group by a.topic_category
    `,
    sql<{ n: number }[]>`
      select count(*)::int as n
      from opportunities
      where niche_id = ${nicheId} and status = 'active'
    `,
    sql<OpportunityRow[]>`
      select id, niche_id, run_id, title, topic, target_audience, pain_point,
             recommended_hook, angle, content_structure, why_now, opportunity_type,
             platform_suggestion, evidence, evidence_video_ids, ai_task_run_id, status, created_at
      from opportunities
      where niche_id = ${nicheId} and status = 'active'
      order by coalesce((evidence->>'matching_videos')::numeric, 0) desc, created_at desc
      limit 1
    `,
    sql<{
      id: string;
      caption: string | null;
      thumbnail_url: string | null;
      author_handle: string | null;
      views: number | string | null;
      viral_score: number | string | null;
      hook_type: string | null;
    }[]>`
      with ${membersCte(sql, nicheId)},
           ${scoresCte(sql, nicheId)},
           ${latestCte(sql, nicheId)},
           ranked as (
             select m.id, m.caption, m.thumbnail_url, m.author_handle, m.views, m.published_at,
                    s.viral_score, s.is_high_potential, a.hook_type,
                    row_number() over (order by s.viral_score desc nulls last, m.id) as score_rank
             from members m
             left join scores s on s.video_id = m.id
             left join latest a on a.video_id = m.id
           )
      select id, caption, thumbnail_url, author_handle, views, viral_score, hook_type
      from ranked
      where is_high_potential = true or score_rank <= 12
      order by published_at desc nulls last, viral_score desc nulls last
      limit 6
    `,
  ]);
  if (!profile) throw new OpportunityNicheNotFoundError();

  const analyzed = Number(analyzedRows[0]?.n) || 0;
  const week = weekRows[0];
  const pains = buckets(stats.pain_point_category, analyzed, 6);
  const hooks = buckets(stats.hook_type, analyzed, 6);
  const topics = buckets(stats.topic_category, analyzed, 6);
  const best = stats.hook_type
    .filter((stat) => stat.count >= 3 && stat.avg_viral_score != null)
    .sort((a, b) => (b.avg_viral_score ?? 0) - (a.avg_viral_score ?? 0) || b.count - a.count || a.key.localeCompare(b.key))[0];
  const recentTopic = topicRows
    .filter((row) => Number(row.recent_count) > 0)
    .sort((a, b) => Number(b.recent_count) - Number(a.recent_count) || a.key.localeCompare(b.key))[0];
  const overallTopic = topicRows
    .slice()
    .sort((a, b) => Number(b.total_count) - Number(a.total_count) || a.key.localeCompare(b.key))[0];
  const emerging = recentTopic
    ? { key: recentTopic.key, count: Number(recentTopic.recent_count) || 0 }
    : overallTopic
      ? { key: overallTopic.key, count: Number(overallTopic.total_count) || 0 }
      : null;

  return {
    niche: { id: profile.id, name: profile.name },
    week: {
      videos_discovered: Number(week?.videos_discovered) || 0,
      high_potential: Number(week?.high_potential) || 0,
      opportunities: Number(activeRows[0]?.n) || 0,
    },
    totals: {
      videos: Number(week?.videos) || 0,
      analyzed,
    },
    trending_pain_point: pains[0] ?? null,
    best_hook: best ? { key: best.key, count: best.count, avg_viral_score: best.avg_viral_score ?? 0 } : null,
    emerging_topic: emerging,
    recommended: recommendedRows[0] ? toOpportunity(recommendedRows[0]) : null,
    top_pain_points: pains,
    top_hooks: hooks,
    top_topics: topics,
    recent_viral: recentRows.map((video) => ({
      id: video.id,
      caption: video.caption,
      thumbnail_url: video.thumbnail_url,
      author_handle: video.author_handle,
      views: num(video.views),
      viral_score: num(video.viral_score),
      hook_type: video.hook_type,
    })),
  };
}
