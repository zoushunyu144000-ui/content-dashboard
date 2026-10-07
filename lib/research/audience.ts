import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { getAIProvider } from '@/lib/research/ai/provider';
import type { JsonSchema } from '@/lib/research/ai/schema';
import { categoryFrequencies, type FrequencyBucket } from '@/lib/research/library';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ARRAY_OID = 2951;

export const AUDIENCE_PROMPT_VERSION = 'aud-v1';

export const AUDIENCE_CATEGORIES = [
  'audience_segment',
  'pain_point',
  'desire',
  'need',
  'objection',
  'question',
  'emotional_trigger',
  'misconception',
  'job_to_be_done',
  'content_gap',
  'conversion_signal',
] as const;

export type AudienceCategory = (typeof AUDIENCE_CATEGORIES)[number];

const LEVELS = ['observed', 'inferred', 'speculative'] as const;
const CONFIDENCE = ['high', 'medium', 'low'] as const;
type ObservationLevel = (typeof LEVELS)[number];
type Confidence = (typeof CONFIDENCE)[number];
type NeedKind = 'functional' | 'emotional';

const ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'description',
    'surface_problem',
    'underlying_problem',
    'underlying_need',
    'desired_outcome',
    'need_kind',
    'video_ids',
    'supporting_quotes',
    'observation_level',
    'confidence',
  ],
  properties: {
    title: { type: 'string', minLength: 1, description: '简体中文短标题' },
    description: { type: 'string', description: '简体中文说明。不适用则空字符串' },
    surface_problem: { type: 'string', description: '表面问题。不适用则空字符串' },
    underlying_problem: { type: 'string', description: '底层问题。不适用则空字符串' },
    underlying_need: { type: 'string', description: '底层需求。不适用则空字符串' },
    desired_outcome: { type: 'string', description: '想要的结果。不适用则空字符串' },
    need_kind: {
      type: 'string',
      enum: ['none', 'functional', 'emotional'],
      description: 'need 用 functional 或 emotional；其他类别用空字符串',
    },
    video_ids: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      description: '只能使用输入视频的 id',
    },
    supporting_quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['video_id', 'quote'],
        properties: {
          video_id: { type: 'string' },
          quote: { type: 'string', description: 'caption、transcript 或评论中的短原文' },
        },
      },
    },
    observation_level: { type: 'string', enum: [...LEVELS] },
    confidence: { type: 'string', enum: [...CONFIDENCE] },
  },
};

const AUDIENCE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...AUDIENCE_CATEGORIES],
  properties: Object.fromEntries(
    AUDIENCE_CATEGORIES.map((category) => [
      category,
      {
        type: 'array',
        minItems: 3,
        maxItems: 8,
        items: ITEM_SCHEMA,
        description: '3 到 8 条',
      } satisfies JsonSchema,
    ]),
  ),
};

const AUDIENCE_SYSTEM = `你是受众情报分析师。只根据这次研究给出的视频写 JSON。正文用简体中文。专有名词、枚举 key、以及引用原文保持原样。

只能使用输入里的视频。禁止编造视频 id。禁止使用输入没有支持的通用行业知识。禁止出现这些套话：内容有价值、标题很吸引人、抓住用户注意力。不要自己计算频率或条数，系统会用证据视频数去除以已分析视频数。

每条都必须引用输入中的 video_ids。supporting_quotes 是 caption、transcript 或评论里的短原文，带上对应 video_id；没有原文就给空数组，不要改写。不适用的文本字段用空字符串。

observation_level 只能是小写：
- observed：OBSERVED，直接出现在 caption、transcript、评论原文或互动数据里
- inferred：INFERRED，由多条事实推导出来
- speculative：SPECULATIVE，证据弱
confidence 只能是 high、medium、low，并且要和证据强度一致。

pain_point 必须写清链条 surface_problem → underlying_problem → underlying_need → desired_outcome。
例：客户总在 WhatsApp 问价格 → 老板每天重复回答相同问题，沟通时间成本高 → 希望客户联系前就完成基本信息获取和筛选 → 减少无效沟通，同时显得更专业。
need 的 need_kind 只能是 functional（功能）或 emotional（心理）。其他类别的 need_kind 用 none。
content_gap 是数据里已经出现、但现有高表现视频没有好好满足的受众需求。
comments_collected 为 false 或某条视频的 comment_texts 为 null 时，评论原文没有采集，不要假装看过评论。
niche 只用于用词，不能当作证据。

类别含义：
- audience_segment：谁被吸引、处于什么状态、为什么会看
- pain_point：从表面问题追到想要的结果
- desire：想要的状态或结果
- need：功能需求或心理需求
- objection：为什么不买、不行动或不相信
- question：观众反复问的问题
- emotional_trigger：促使停留、互动或行动的情绪
- misconception：内容或观众表达里的误解
- job_to_be_done：观众要完成的任务
- content_gap：数据里有需求，但头部视频没满足
- conversion_signal：指向咨询、收藏、搜索或成交的信号

每个类别 3 到 8 条。`;

export class AudienceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudienceInputError';
  }
}

export class AudienceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudienceNotFoundError';
  }
}

export interface AudienceQuote {
  video_id: string;
  quote: string;
}

export interface AudienceInsight {
  id: string;
  category: AudienceCategory;
  title: string;
  description: string | null;
  surface_problem: string | null;
  underlying_problem: string | null;
  underlying_need: string | null;
  desired_outcome: string | null;
  need_kind: NeedKind | null;
  frequency_pct: number | null;
  evidence_count: number;
  high_potential_count: number;
  evidence_video_ids: string[];
  supporting_quotes: AudienceQuote[];
  signals: unknown;
  confidence: Confidence | null;
  observation_level: ObservationLevel | null;
  rank: number | null;
}

export interface AudienceReport {
  generated_at: string | null;
  analysed_videos: number;
  categories: Record<AudienceCategory, AudienceInsight[]>;
}

interface RunContext {
  id: string;
  project_id: string;
  topic: string;
  name: string;
  niche: string | null;
  audience: string | null;
  target_audience: string | null;
  core_business: string | null;
  content_goal: string | null;
  core_pain_points: string[] | null;
  content_pillars: string[] | null;
}

interface VideoRow {
  id: string;
  caption: string | null;
  transcript: string | null;
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  viral_score: number | string | null;
  is_high_potential: boolean;
  audience: string | null;
  pain_point: string | null;
  pain_point_category: string | null;
  topic: string | null;
  hook: string | null;
  hook_type: string | null;
  emotion: string | null;
  why_it_works: string | null;
  tags: string[] | null;
  value_types: unknown;
  cta_type: string | null;
  comment_texts: string | null;
}

interface InsightRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  surface_problem: string | null;
  underlying_problem: string | null;
  underlying_need: string | null;
  desired_outcome: string | null;
  need_kind: string | null;
  frequency_pct: number | string | null;
  evidence_count: number | null;
  high_potential_count: number | null;
  evidence_video_ids: string[] | null;
  supporting_quotes: unknown;
  signals: unknown;
  confidence: string | null;
  observation_level: string | null;
  rank: number | null;
  created_at: Date | string | null;
}

interface PreparedInsight {
  category: AudienceCategory;
  title: string;
  description: string | null;
  surfaceProblem: string | null;
  underlyingProblem: string | null;
  underlyingNeed: string | null;
  desiredOutcome: string | null;
  needKind: NeedKind | null;
  frequencyPct: number;
  evidenceCount: number;
  highPotentialCount: number;
  videoIds: string[];
  quotes: AudienceQuote[];
  confidence: Confidence;
  observationLevel: ObservationLevel;
  rank: number;
}

interface DraftInsight extends Omit<PreparedInsight, 'rank'> {
  index: number;
}

type Sql = ReturnType<typeof getDb>;

const INSIGHT_COLUMNS = `
  id, category, title, description, surface_problem, underlying_problem,
  underlying_need, desired_outcome, need_kind, frequency_pct, evidence_count,
  high_potential_count, evidence_video_ids, supporting_quotes, signals,
  confidence, observation_level, rank, created_at
`;

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new AudienceInputError(`Invalid ${label}`);
}

function isCategory(value: string): value is AudienceCategory {
  return (AUDIENCE_CATEGORIES as readonly string[]).includes(value);
}

function isLevel(value: string): value is ObservationLevel {
  return (LEVELS as readonly string[]).includes(value);
}

function isConfidence(value: string): value is Confidence {
  return (CONFIDENCE as readonly string[]).includes(value);
}

function isNeedKind(value: string): value is NeedKind {
  return value === 'functional' || value === 'emotional';
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function blank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

function oneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function emptyCategories(): Record<AudienceCategory, AudienceInsight[]> {
  return {
    audience_segment: [],
    pain_point: [],
    desire: [],
    need: [],
    objection: [],
    question: [],
    emotional_trigger: [],
    misconception: [],
    job_to_be_done: [],
    content_gap: [],
    conversion_signal: [],
  };
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseQuotes(value: unknown): AudienceQuote[] {
  if (!Array.isArray(value)) return [];
  const quotes: AudienceQuote[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const videoId = text(record.video_id);
    const quote = text(record.quote);
    if (!videoId || !quote) continue;
    quotes.push({ video_id: videoId, quote });
  }
  return quotes;
}

function toInsight(row: InsightRow): AudienceInsight | null {
  if (!isCategory(row.category)) return null;
  const level = row.observation_level && isLevel(row.observation_level) ? row.observation_level : null;
  const confidence = row.confidence && isConfidence(row.confidence) ? row.confidence : null;
  const needKind = row.need_kind && isNeedKind(row.need_kind) ? row.need_kind : null;
  const frequency = num(row.frequency_pct);
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    surface_problem: row.surface_problem,
    underlying_problem: row.underlying_problem,
    underlying_need: row.underlying_need,
    desired_outcome: row.desired_outcome,
    need_kind: needKind,
    frequency_pct: frequency == null ? null : oneDecimal(frequency),
    evidence_count: Number(row.evidence_count) || 0,
    high_potential_count: Number(row.high_potential_count) || 0,
    evidence_video_ids: row.evidence_video_ids ?? [],
    supporting_quotes: parseQuotes(row.supporting_quotes),
    signals: row.signals,
    confidence,
    observation_level: level,
    rank: row.rank,
  };
}

function validIds(value: unknown, allowed: Map<string, string>): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const canonical = allowed.get(item.trim().toLowerCase());
    if (canonical && !ids.includes(canonical)) ids.push(canonical);
  }
  return ids;
}

async function loadRun(sql: Sql, runId: string): Promise<RunContext | null> {
  const rows = await sql<RunContext[]>`
    select r.id, r.project_id, r.topic, p.name, p.niche, p.audience,
           p.target_audience, p.core_business, p.content_goal,
           p.core_pain_points, p.content_pillars
    from research_runs r
    join projects p on p.id = r.project_id
    where r.id = ${runId}
    limit 1
  `;
  return rows[0] ?? null;
}

async function countAnalysed(sql: Sql, runId: string, nicheId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(distinct v.id)::int as n
    from research_run_videos rv
    join videos v on v.id = rv.video_id
    join video_analyses a on a.video_id = rv.video_id
      and a.is_latest = true
      and a.status = 'complete'
      and a.niche_id = ${nicheId}
    where rv.run_id = ${runId}
  `;
  return Number(rows[0]?.n) || 0;
}

async function loadVideos(sql: Sql, runId: string, nicheId: string): Promise<VideoRow[]> {
  return sql<VideoRow[]>`
    select id, caption, transcript, views, likes, comments, viral_score, is_high_potential,
           audience, pain_point, pain_point_category, topic, hook, hook_type, emotion,
           why_it_works, tags, value_types, cta_type, comment_texts
    from (
      select distinct on (v.id)
        v.id,
        left(v.caption, 200) as caption,
        left(v.transcript, 400) as transcript,
        v.views,
        v.likes,
        v.comments,
        rv.viral_score::float8 as viral_score,
        rv.is_high_potential,
        a.audience,
        a.pain_point,
        a.pain_point_category,
        a.topic,
        a.hook,
        a.hook_type,
        a.emotion,
        left(a.why_it_works, 200) as why_it_works,
        coalesce(a.tags, '{}') as tags,
        a.value_types,
        a.cta_type,
        case
          when jsonb_typeof(v.raw->'comments') = 'string' and length(btrim(v.raw->>'comments')) > 0
            then left(btrim(v.raw->>'comments'), 600)
          when jsonb_typeof(v.raw->'comments') = 'array' then (
            select left(string_agg(snippet, chr(10) order by ord), 600)
            from (
              select elem.ord,
                     left(btrim(coalesce(
                       case when jsonb_typeof(elem.value) = 'string' then elem.value #>> '{}' end,
                       elem.value->>'text',
                       elem.value->>'content',
                       elem.value->>'comment',
                       elem.value->>'body'
                     )), 160) as snippet
              from jsonb_array_elements(v.raw->'comments') with ordinality as elem(value, ord)
              where elem.ord <= 6
            ) picked
            where snippet is not null and snippet <> ''
          )
          else null
        end as comment_texts
      from research_run_videos rv
      join videos v on v.id = rv.video_id
      join video_analyses a on a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
        and a.niche_id = ${nicheId}
      where rv.run_id = ${runId}
      order by v.id, a.created_at desc
    ) sampled
    order by viral_score desc nulls last, id
  `;
}

function promptVideo(row: VideoRow) {
  const comments = row.comment_texts
    ? row.comment_texts
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : null;
  return {
    id: row.id,
    caption: row.caption,
    transcript: row.transcript,
    views: num(row.views),
    likes: num(row.likes),
    comments: num(row.comments),
    viral_score: num(row.viral_score),
    is_high_potential: row.is_high_potential === true,
    audience: row.audience,
    pain_point: row.pain_point,
    pain_point_category: row.pain_point_category,
    topic: row.topic,
    hook: row.hook,
    hook_type: row.hook_type,
    emotion: row.emotion,
    why_it_works: row.why_it_works,
    tags: row.tags ?? [],
    value_types: row.value_types ?? null,
    cta_type: row.cta_type,
    comment_texts: comments && comments.length > 0 ? comments : null,
  };
}

function pickFrequencies(frequencies: {
  pain_point_category: FrequencyBucket[];
  topic_category: FrequencyBucket[];
  hook_type: FrequencyBucket[];
  emotion: FrequencyBucket[];
  audience_category: FrequencyBucket[];
  tags: FrequencyBucket[];
}) {
  return {
    pain_point_category: frequencies.pain_point_category,
    topic_category: frequencies.topic_category,
    hook_type: frequencies.hook_type,
    emotion: frequencies.emotion,
    audience_category: frequencies.audience_category,
    tags: frequencies.tags.slice(0, 20),
  };
}

function prepareInsights(
  data: Record<string, unknown>,
  allowed: Map<string, string>,
  highPotential: Set<string>,
  analysed: number,
): PreparedInsight[] {
  const prepared: PreparedInsight[] = [];
  for (const category of AUDIENCE_CATEGORIES) {
    const rawItems = Array.isArray(data[category]) ? data[category] : [];
    const items: DraftInsight[] = [];
    rawItems.forEach((raw, index) => {
      const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const title = text(record.title);
      if (!title) return;
      const videoIds = validIds(record.video_ids, allowed);
      const quotes: AudienceQuote[] = [];
      const rawQuotes = Array.isArray(record.supporting_quotes) ? record.supporting_quotes : [];
      for (const rawQuote of rawQuotes) {
        if (!rawQuote || typeof rawQuote !== 'object') continue;
        const quoteRecord = rawQuote as Record<string, unknown>;
        const quoteIds = validIds([quoteRecord.video_id], allowed);
        const quote = text(quoteRecord.quote).slice(0, 240);
        if (!quoteIds[0] || !quote) continue;
        const key = `${quoteIds[0]}:${quote}`;
        if (quotes.some((item) => `${item.video_id}:${item.quote}` === key)) continue;
        quotes.push({ video_id: quoteIds[0], quote });
      }
      const evidenceCount = videoIds.length;
      const weak = evidenceCount === 0;
      const levelText = text(record.observation_level).toLowerCase();
      const confidenceText = text(record.confidence).toLowerCase();
      const needKindText = text(record.need_kind);
      items.push({
        category,
        title,
        description: blank(text(record.description)),
        surfaceProblem: blank(text(record.surface_problem)),
        underlyingProblem: blank(text(record.underlying_problem)),
        underlyingNeed: blank(text(record.underlying_need)),
        desiredOutcome: blank(text(record.desired_outcome)),
        needKind: isNeedKind(needKindText) ? needKindText : null,
        frequencyPct: analysed > 0 ? oneDecimal((evidenceCount / analysed) * 100) : 0,
        evidenceCount,
        highPotentialCount: videoIds.filter((id) => highPotential.has(id)).length,
        videoIds,
        quotes,
        confidence: weak ? 'low' : isConfidence(confidenceText) ? confidenceText : 'medium',
        observationLevel: weak ? 'speculative' : isLevel(levelText) ? levelText : 'inferred',
        index,
      });
    });
    items.sort((a, b) => b.evidenceCount - a.evidenceCount || a.index - b.index);
    items.forEach((item, rank) => {
      const { index: _index, ...rest } = item;
      prepared.push({ ...rest, rank: rank + 1 });
    });
  }
  return prepared;
}

export async function getAudienceIntelligence(runId: string): Promise<AudienceReport> {
  assertUuid(runId, 'run id');
  const sql = getDb();
  const run = await loadRun(sql, runId);
  if (!run) throw new AudienceNotFoundError('Research run was not found');
  const [analysed, rows] = await Promise.all([
    countAnalysed(sql, runId, run.project_id),
    sql<InsightRow[]>`
      select ${sql.unsafe(INSIGHT_COLUMNS)}
      from audience_insights
      where run_id = ${runId} and status = 'active'
      order by rank asc nulls last, evidence_count desc nulls last, title
    `,
  ]);
  const categories = emptyCategories();
  let generatedAt: string | null = null;
  for (const row of rows) {
    const insight = toInsight(row);
    if (!insight) continue;
    categories[insight.category].push(insight);
    const stamp = iso(row.created_at);
    if (stamp && (!generatedAt || stamp > generatedAt)) generatedAt = stamp;
  }
  return { generated_at: generatedAt, analysed_videos: analysed, categories };
}

export async function generateAudienceIntelligence(runId: string): Promise<AudienceReport> {
  assertUuid(runId, 'run id');
  const sql = getDb();
  const run = await loadRun(sql, runId);
  if (!run) throw new AudienceNotFoundError('Research run was not found');

  const [videoRows, stats] = await Promise.all([
    loadVideos(sql, runId, run.project_id),
    categoryFrequencies({ nicheId: run.project_id, runId, window: 'run' }),
  ]);
  if (videoRows.length === 0) throw new AudienceInputError('This run has no analysed videos');

  const videos = videoRows.map(promptVideo);
  const analysed = videoRows.length;
  const allowed = new Map(videos.map((video) => [video.id.toLowerCase(), video.id]));
  const highPotential = new Set(videos.filter((video) => video.is_high_potential).map((video) => video.id));
  const commentsCollected = videos.some((video) => video.comment_texts != null && video.comment_texts.length > 0);

  const ai = getAIProvider('intel');
  const result = await ai.completeJson<Record<string, unknown>>({
    task: 'audience_intelligence',
    system: AUDIENCE_SYSTEM,
    user: JSON.stringify({
      niche: {
        name: run.name,
        business: run.core_business || run.niche,
        target_audience: run.target_audience || run.audience,
        content_goal: run.content_goal,
        core_pain_points: run.core_pain_points ?? [],
        content_pillars: run.content_pillars ?? [],
      },
      topic: run.topic,
      analysed_videos: analysed,
      sql_analysed_videos: stats.analyzed_count,
      high_potential_videos: highPotential.size,
      comments_collected: commentsCollected,
      frequencies: pickFrequencies(stats.frequencies),
      videos,
    }),
    schemaName: 'audience_intelligence',
    schema: AUDIENCE_SCHEMA,
    maxTokens: 16000,
    timeoutMs: 240000,
    promptVersion: AUDIENCE_PROMPT_VERSION,
    inputSource: { run_id: runId, niche_id: run.project_id },
  });

  const prepared = prepareInsights(result.data, allowed, highPotential, analysed);
  if (prepared.length === 0) throw new Error('Audience model returned no usable insights');

  const generationId = randomUUID();
  await sql.begin(async (tx) => {
    const locked = await tx<{ id: string }[]>`
      select id from research_runs where id = ${runId} for update
    `;
    if (!locked[0]) throw new AudienceNotFoundError('Research run was not found');
    await tx`
      update audience_insights
      set status = 'superseded'
      where run_id = ${runId} and status = 'active'
    `;
    for (const item of prepared) {
      await tx`
        insert into audience_insights (
          run_id, niche_id, category, title, description, surface_problem,
          underlying_problem, underlying_need, desired_outcome, need_kind,
          frequency_pct, evidence_count, high_potential_count, evidence_video_ids,
          supporting_quotes, signals, confidence, observation_level, rank,
          generation_id, status, ai_task_run_id, model, prompt_version
        ) values (
          ${runId},
          ${run.project_id},
          ${item.category},
          ${item.title},
          ${item.description},
          ${item.surfaceProblem},
          ${item.underlyingProblem},
          ${item.underlyingNeed},
          ${item.desiredOutcome},
          ${item.needKind},
          ${item.frequencyPct},
          ${item.evidenceCount},
          ${item.highPotentialCount},
          ${item.videoIds.length > 0 ? tx.array(item.videoIds, UUID_ARRAY_OID) : tx`'{}'::uuid[]`},
          ${tx.json(item.quotes as never)},
          ${null},
          ${item.confidence},
          ${item.observationLevel},
          ${item.rank},
          ${generationId},
          'active',
          ${result.aiTaskRunId},
          ${result.model},
          ${AUDIENCE_PROMPT_VERSION}
        )
      `;
    }
  });

  return getAudienceIntelligence(runId);
}
