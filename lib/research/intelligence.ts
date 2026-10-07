import 'server-only';
import { getDb } from '@/lib/db';
import { isAIAnalysisError, getAIProvider } from '@/lib/research/ai/provider';
import type { JsonSchema } from '@/lib/research/ai/schema';
import {
  categoryFrequencies,
  type CategoryFrequencies,
  type FrequencyBucket,
} from '@/lib/research/library';
import { ANALYSIS_ENUM_COLUMNS } from '@/lib/research/taxonomy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RUN_PROMPT_VERSION = 'l2-v1';
export const NICHE_PROMPT_VERSION = 'l3-v1';

export type NicheWindow = '7d' | '30d' | 'all';

const RUN_LISTS = [
  'top_pain_points',
  'top_topics',
  'top_hooks',
  'repeated_patterns',
  'unexpected_patterns',
  'emerging_topics',
  'audience_questions',
  'conversion_signals',
] as const;

const NICHE_LISTS = [
  'long_term_patterns',
  'recent_changes',
  'rising_topics',
  'declining_topics',
  'faded_patterns',
  'new_opportunities',
] as const;

const ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'explanation', 'video_ids'],
  properties: {
    label: { type: 'string', description: '简体中文短标签' },
    explanation: { type: 'string', description: '简体中文，说明这条结论为什么成立' },
    video_ids: {
      type: 'array',
      items: { type: 'string' },
      description: '只能使用输入样本里的视频 id；没有直接证据则空数组',
    },
  },
};

const RUN_SYSTEM = `你是短视频内容情报分析师。只根据给定的频次统计和视频分析样本，用简体中文输出 JSON。
每条结论包含 label（短标签）、explanation（为什么成立）、video_ids（只能使用输入视频的 id，没有证据则给空数组）。
不要编造不存在的视频 id。专有名词和枚举 key 可以保留原文，分析正文用简体中文。
summary 概括这一次研究批次的主要规律。
top_pain_points、top_topics、top_hooks 是最值得跟的痛点、话题和钩子。
repeated_patterns 是反复出现的结构或表达。
unexpected_patterns 是反直觉或样本不多但高效的模式。
emerging_topics 是正在冒头的话题。
audience_questions 是观众真正在问的问题。
conversion_signals 是指向信任、收藏、搜索或成交的信号。`;

const NICHE_SYSTEM = `你是赛道级内容情报分析师。只根据给定时间窗口的频次、与上一周期的涨跌（frequencies.trend），以及视频样本，用简体中文输出 JSON。
每条结论包含 label、explanation、video_ids（只能使用输入视频 id，没有证据则空数组）。
不要编造视频 id。专有名词和枚举 key 可以保留原文，分析正文用简体中文。
summary 概括这个赛道在该时间窗口的内容格局。
long_term_patterns 是跨周期仍稳定的规律。
recent_changes 是这一窗口相对上一周期的明显变化。time_window 为 all 或 trend.previous_window 为 null 时，不要假装有涨跌。
rising_topics 对应正在变多的话题，优先参考 trend.rising。
declining_topics 对应正在减少的话题，优先参考 trend.declining。
faded_patterns 是热度过了、不该再跟的打法。
new_opportunities 是现在值得做的内容机会。`;

export class IntelligenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntelligenceInputError';
  }
}

export class IntelligenceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntelligenceNotFoundError';
  }
}

export interface InsightItem {
  label: string;
  explanation: string;
  video_ids: string[];
}

export interface TrendPoint {
  column: string;
  key: string;
  count: number;
  pct: number;
  previous_count: number;
  previous_pct: number;
  delta: number;
}

export interface IntelligenceReport {
  id: string;
  level: 'run' | 'niche';
  niche_id: string;
  run_id: string | null;
  time_window: 'run' | NicheWindow;
  video_count: number | null;
  analyzed_count: number | null;
  frequencies: unknown;
  summary: unknown;
  raw_json: unknown;
  model: string | null;
  prompt_version: string | null;
  status: string;
  error: string | null;
  ai_task_run_id: string | null;
  created_at: Date | string;
}

interface CompactVideo {
  id: string;
  caption: string | null;
  viral_score: number | null;
  pain_point: string | null;
  topic: string | null;
  hook: string | null;
  hook_type: string | null;
  why_it_works: string | null;
  tags: string[];
}

interface ReportRow {
  id: string;
  level: string;
  niche_id: string;
  run_id: string | null;
  time_window: string;
  video_count: number | null;
  analyzed_count: number | null;
  frequencies: unknown;
  summary: unknown;
  raw_json: unknown;
  model: string | null;
  prompt_version: string | null;
  status: string;
  error: string | null;
  ai_task_run_id: string | null;
  created_at: Date | string;
}

type Sql = ReturnType<typeof getDb>;
type FrequencyMap = CategoryFrequencies['frequencies'];

const REPORT_COLUMNS = `
  id, level, niche_id, run_id, time_window, video_count, analyzed_count,
  frequencies, summary, raw_json, model, prompt_version, status, error,
  ai_task_run_id, created_at
`;

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) throw new IntelligenceInputError(`Invalid ${label}`);
}

function schemaFor(listKeys: readonly string[]): JsonSchema {
  const properties: Record<string, JsonSchema> = {
    summary: { type: 'string', description: '简体中文总览' },
  };
  for (const key of listKeys) properties[key] = { type: 'array', items: ITEM_SCHEMA };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', ...listKeys],
    properties,
  };
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asItems(value: unknown, allowed: Map<string, string>): InsightItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const rawIds = Array.isArray(record.video_ids) ? record.video_ids : [];
    const videoIds: string[] = [];
    for (const id of rawIds) {
      if (typeof id !== 'string') continue;
      const canonical = allowed.get(id.toLowerCase());
      if (canonical && !videoIds.includes(canonical)) videoIds.push(canonical);
    }
    return {
      label: typeof record.label === 'string' ? record.label : '',
      explanation: typeof record.explanation === 'string' ? record.explanation : '',
      video_ids: videoIds,
    };
  });
}

function sanitizeSummary(
  data: Record<string, unknown>,
  listKeys: readonly string[],
  allowed: Map<string, string>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    summary: typeof data.summary === 'string' ? data.summary : '',
  };
  for (const key of listKeys) summary[key] = asItems(data[key], allowed);
  return summary;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function collectTrend(
  column: string,
  current: FrequencyBucket[],
  previous: FrequencyBucket[],
  rows: TrendPoint[],
): void {
  const cur = new Map(current.map((bucket) => [bucket.key, bucket]));
  const prev = new Map(previous.map((bucket) => [bucket.key, bucket]));
  const keys = Array.from(new Set(Array.from(cur.keys()).concat(Array.from(prev.keys()))));
  for (const key of keys) {
    const pct = cur.get(key)?.pct ?? 0;
    const previousPct = prev.get(key)?.pct ?? 0;
    const delta = round1(pct - previousPct);
    if (delta === 0) continue;
    rows.push({
      column,
      key,
      count: cur.get(key)?.count ?? 0,
      pct,
      previous_count: prev.get(key)?.count ?? 0,
      previous_pct: previousPct,
      delta,
    });
  }
}

function trendFor(current: FrequencyMap, previous: FrequencyMap | null, previousWindow: '14d-7d' | '60d-30d' | null) {
  const rows: TrendPoint[] = [];
  if (previous) {
    for (const column of ANALYSIS_ENUM_COLUMNS) {
      collectTrend(column, current[column] || [], previous[column] || [], rows);
    }
    collectTrend('tags', current.tags || [], previous.tags || [], rows);
    const types = Array.from(
      new Set(Object.keys(current.value_types || {}).concat(Object.keys(previous.value_types || {}))),
    );
    for (const type of types) {
      collectTrend(
        `value_types.${type}`,
        current.value_types?.[type] || [],
        previous.value_types?.[type] || [],
        rows,
      );
    }
  }
  const rising = rows
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta || b.count - a.count || a.key.localeCompare(b.key));
  const declining = rows
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta || b.previous_count - a.previous_count || a.key.localeCompare(b.key));
  return { previous_window: previousWindow, rising, declining };
}

function toReport(row: ReportRow): IntelligenceReport {
  return {
    id: row.id,
    level: row.level === 'niche' ? 'niche' : 'run',
    niche_id: row.niche_id,
    run_id: row.run_id,
    time_window: row.time_window as IntelligenceReport['time_window'],
    video_count: row.video_count,
    analyzed_count: row.analyzed_count,
    frequencies: row.frequencies,
    summary: row.summary,
    raw_json: row.raw_json,
    model: row.model,
    prompt_version: row.prompt_version,
    status: row.status,
    error: row.error,
    ai_task_run_id: row.ai_task_run_id,
    created_at: row.created_at,
  };
}

async function insertReport(
  sql: Sql,
  input: {
    level: 'run' | 'niche';
    nicheId: string;
    runId: string | null;
    timeWindow: string;
    videoCount: number | null;
    analyzedCount: number | null;
    frequencies: unknown;
    summary: unknown;
    rawJson: unknown;
    model: string | null;
    promptVersion: string;
    status: 'complete' | 'failed';
    error: string | null;
    aiTaskRunId: string | null;
  },
): Promise<IntelligenceReport> {
  const rows = await sql<ReportRow[]>`
    insert into intelligence_reports (
      level, niche_id, run_id, time_window, video_count, analyzed_count,
      frequencies, summary, raw_json, model, prompt_version, status, error, ai_task_run_id
    ) values (
      ${input.level},
      ${input.nicheId},
      ${input.runId},
      ${input.timeWindow},
      ${input.videoCount},
      ${input.analyzedCount},
      ${input.frequencies == null ? null : sql.json(input.frequencies as never)},
      ${input.summary == null ? null : sql.json(input.summary as never)},
      ${input.rawJson == null ? null : sql.json(input.rawJson as never)},
      ${input.model},
      ${input.promptVersion},
      ${input.status},
      ${input.error ? input.error.slice(0, 4000) : null},
      ${input.aiTaskRunId}
    )
    returning ${sql.unsafe(REPORT_COLUMNS)}
  `;
  const row = rows[0];
  if (!row) throw new Error('Could not store the intelligence report');
  return toReport(row);
}

async function recordFailure(
  sql: Sql,
  input: {
    level: 'run' | 'niche';
    nicheId: string;
    runId: string | null;
    timeWindow: string;
    videoCount: number | null;
    analyzedCount: number | null;
    frequencies: unknown;
    promptVersion: string;
    err: unknown;
    aiTaskRunId: string | null;
    model: string | null;
  },
): Promise<void> {
  const message = input.err instanceof Error ? input.err.message : 'AI request failed';
  const taskId = input.aiTaskRunId ?? (isAIAnalysisError(input.err) ? input.err.aiTaskRunId : null);
  try {
    await insertReport(sql, {
      level: input.level,
      nicheId: input.nicheId,
      runId: input.runId,
      timeWindow: input.timeWindow,
      videoCount: input.videoCount,
      analyzedCount: input.analyzedCount,
      frequencies: input.frequencies,
      summary: null,
      rawJson: null,
      model: input.model,
      promptVersion: input.promptVersion,
      status: 'failed',
      error: message,
      aiTaskRunId: taskId,
    });
  } catch (writeErr) {
    console.error('[intelligence] failed report insert', writeErr);
  }
}

function compact(row: {
  id: string;
  caption: string | null;
  viral_score: number | string | null;
  pain_point: string | null;
  topic: string | null;
  hook: string | null;
  hook_type: string | null;
  why_it_works: string | null;
  tags: string[] | null;
}): CompactVideo {
  return {
    id: row.id,
    caption: row.caption,
    viral_score: num(row.viral_score),
    pain_point: row.pain_point,
    topic: row.topic,
    hook: row.hook,
    hook_type: row.hook_type,
    why_it_works: row.why_it_works,
    tags: row.tags ?? [],
  };
}

export async function getLatestRunIntelligence(runId: string): Promise<IntelligenceReport | null> {
  assertUuid(runId, 'run id');
  const sql = getDb();
  const rows = await sql<ReportRow[]>`
    select ${sql.unsafe(REPORT_COLUMNS)}
    from intelligence_reports
    where run_id = ${runId} and level = 'run'
    order by created_at desc
    limit 1
  `;
  return rows[0] ? toReport(rows[0]) : null;
}

export async function getLatestNicheIntelligence(
  nicheId: string,
  window: NicheWindow,
): Promise<IntelligenceReport | null> {
  assertUuid(nicheId, 'niche id');
  const sql = getDb();
  const rows = await sql<ReportRow[]>`
    select ${sql.unsafe(REPORT_COLUMNS)}
    from intelligence_reports
    where niche_id = ${nicheId} and level = 'niche' and time_window = ${window}
    order by created_at desc
    limit 1
  `;
  return rows[0] ? toReport(rows[0]) : null;
}

export function parseNicheWindow(value: string | null): NicheWindow {
  const window = value && value.trim() ? value.trim() : 'all';
  if (window !== '7d' && window !== '30d' && window !== 'all') {
    throw new IntelligenceInputError('Invalid window');
  }
  return window;
}

export async function generateRunIntelligence(runId: string): Promise<IntelligenceReport> {
  assertUuid(runId, 'run id');
  const sql = getDb();
  const runs = await sql<
    {
      id: string;
      project_id: string;
      topic: string;
      name: string;
      niche: string | null;
      audience: string | null;
      target_audience: string | null;
      core_business: string | null;
      content_goal: string | null;
    }[]
  >`
    select r.id, r.project_id, r.topic, p.name, p.niche, p.audience,
           p.target_audience, p.core_business, p.content_goal
    from research_runs r
    join projects p on p.id = r.project_id
    where r.id = ${runId}
    limit 1
  `;
  const run = runs[0];
  if (!run) throw new IntelligenceNotFoundError('Research run was not found');

  let videoCount: number | null = null;
  let analyzedCount: number | null = null;
  let frequencies: unknown = null;
  let model: string | null = null;
  let aiTaskRunId: string | null = null;
  try {
    const stats = await categoryFrequencies({ nicheId: run.project_id, runId, window: 'run' });
    videoCount = stats.video_count;
    analyzedCount = stats.analyzed_count;
    frequencies = stats.frequencies;
    const videoRows = await sql<
      {
        id: string;
        caption: string | null;
        viral_score: number | string | null;
        pain_point: string | null;
        topic: string | null;
        hook: string | null;
        hook_type: string | null;
        why_it_works: string | null;
        tags: string[] | null;
      }[]
    >`
      select v.id,
             left(v.caption, 120) as caption,
             rv.viral_score::float8 as viral_score,
             a.pain_point,
             a.topic,
             a.hook,
             a.hook_type,
             left(a.why_it_works, 200) as why_it_works,
             coalesce(a.tags, '{}') as tags
      from research_run_videos rv
      join videos v on v.id = rv.video_id
      join video_analyses a on a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
        and a.niche_id = ${run.project_id}
      where rv.run_id = ${runId}
      order by rv.viral_score desc nulls last, v.id
      limit 40
    `;
    const videos = videoRows.map(compact);
    const allowed = new Map(videos.map((video) => [video.id.toLowerCase(), video.id]));
    const ai = getAIProvider('intel');
    const result = await ai.completeJson<Record<string, unknown>>({
      task: 'run_intelligence',
      system: RUN_SYSTEM,
      user: JSON.stringify({
        niche: {
          name: run.name,
          niche: run.core_business || run.niche,
          audience: run.target_audience || run.audience,
          content_goal: run.content_goal,
        },
        topic: run.topic,
        video_count: videoCount,
        analyzed_count: analyzedCount,
        frequencies,
        videos,
      }),
      schemaName: 'run_intelligence',
      schema: schemaFor(RUN_LISTS),
      maxTokens: 12000,
      timeoutMs: 180000,
      promptVersion: RUN_PROMPT_VERSION,
      inputSource: { run_id: runId, niche_id: run.project_id, window: 'run' },
    });
    model = result.model;
    aiTaskRunId = result.aiTaskRunId;
    const summary = sanitizeSummary(result.data, RUN_LISTS, allowed);
    return await insertReport(sql, {
      level: 'run',
      nicheId: run.project_id,
      runId,
      timeWindow: 'run',
      videoCount,
      analyzedCount,
      frequencies,
      summary,
      rawJson: result.data,
      model,
      promptVersion: RUN_PROMPT_VERSION,
      status: 'complete',
      error: null,
      aiTaskRunId,
    });
  } catch (err) {
    await recordFailure(sql, {
      level: 'run',
      nicheId: run.project_id,
      runId,
      timeWindow: 'run',
      videoCount,
      analyzedCount,
      frequencies,
      promptVersion: RUN_PROMPT_VERSION,
      err,
      aiTaskRunId,
      model,
    });
    throw err;
  }
}

async function loadNicheVideos(sql: Sql, nicheId: string, window: NicheWindow): Promise<CompactVideo[]> {
  const timeFilter =
    window === '7d'
      ? sql`and v.first_seen_at >= now() - interval '7 days'`
      : window === '30d'
        ? sql`and v.first_seen_at >= now() - interval '30 days'`
        : sql``;
  const rows = await sql<
    {
      id: string;
      caption: string | null;
      viral_score: number | string | null;
      pain_point: string | null;
      topic: string | null;
      hook: string | null;
      hook_type: string | null;
      why_it_works: string | null;
      tags: string[] | null;
    }[]
  >`
    select v.id,
           left(v.caption, 120) as caption,
           s.viral_score::float8 as viral_score,
           a.pain_point,
           a.topic,
           a.hook,
           a.hook_type,
           left(a.why_it_works, 200) as why_it_works,
           coalesce(a.tags, '{}') as tags
    from video_analyses a
    join videos v on v.id = a.video_id
    left join lateral (
      select rv.viral_score
      from research_run_videos rv
      join research_runs r on r.id = rv.run_id
      where rv.video_id = v.id and r.project_id = ${nicheId}
      order by rv.viral_score desc nulls last
      limit 1
    ) s on true
    where a.niche_id = ${nicheId}
      and a.is_latest = true
      and a.status = 'complete'
      ${timeFilter}
    order by s.viral_score desc nulls last, v.first_seen_at desc, v.id
    limit 40
  `;
  return rows.map(compact);
}

export async function generateNicheIntelligence(nicheId: string, window: NicheWindow): Promise<IntelligenceReport> {
  assertUuid(nicheId, 'niche id');
  const sql = getDb();
  const niches = await sql<
    {
      id: string;
      name: string;
      niche: string | null;
      audience: string | null;
      target_audience: string | null;
      core_business: string | null;
      content_goal: string | null;
    }[]
  >`
    select id, name, niche, audience, target_audience, core_business, content_goal
    from projects
    where id = ${nicheId}
    limit 1
  `;
  const niche = niches[0];
  if (!niche) throw new IntelligenceNotFoundError('Niche was not found');

  let videoCount: number | null = null;
  let analyzedCount: number | null = null;
  let frequencies: unknown = null;
  let model: string | null = null;
  let aiTaskRunId: string | null = null;
  try {
    const stats = await categoryFrequencies({ nicheId, window });
    videoCount = stats.video_count;
    analyzedCount = stats.analyzed_count;
    const previous =
      window === '7d' || window === '30d'
        ? await categoryFrequencies({ nicheId, window, period: 'previous' })
        : null;
    const previousWindow = window === '7d' ? '14d-7d' : window === '30d' ? '60d-30d' : null;
    frequencies = {
      ...stats.frequencies,
      trend: trendFor(stats.frequencies, previous?.frequencies ?? null, previousWindow),
    };
    const videos = await loadNicheVideos(sql, nicheId, window);
    const allowed = new Map(videos.map((video) => [video.id.toLowerCase(), video.id]));
    const ai = getAIProvider('intel');
    const result = await ai.completeJson<Record<string, unknown>>({
      task: 'niche_intelligence',
      system: NICHE_SYSTEM,
      user: JSON.stringify({
        niche: {
          name: niche.name,
          niche: niche.core_business || niche.niche,
          audience: niche.target_audience || niche.audience,
          content_goal: niche.content_goal,
        },
        time_window: window,
        video_count: videoCount,
        analyzed_count: analyzedCount,
        frequencies,
        videos,
      }),
      schemaName: 'niche_intelligence',
      schema: schemaFor(NICHE_LISTS),
      maxTokens: 12000,
      timeoutMs: 180000,
      promptVersion: NICHE_PROMPT_VERSION,
      inputSource: { niche_id: nicheId, window },
    });
    model = result.model;
    aiTaskRunId = result.aiTaskRunId;
    const summary = sanitizeSummary(result.data, NICHE_LISTS, allowed);
    return await insertReport(sql, {
      level: 'niche',
      nicheId,
      runId: null,
      timeWindow: window,
      videoCount,
      analyzedCount,
      frequencies,
      summary,
      rawJson: result.data,
      model,
      promptVersion: NICHE_PROMPT_VERSION,
      status: 'complete',
      error: null,
      aiTaskRunId,
    });
  } catch (err) {
    await recordFailure(sql, {
      level: 'niche',
      nicheId,
      runId: null,
      timeWindow: window,
      videoCount,
      analyzedCount,
      frequencies,
      promptVersion: NICHE_PROMPT_VERSION,
      err,
      aiTaskRunId,
      model,
    });
    throw err;
  }
}
