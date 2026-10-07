import 'server-only';
import { getDb } from '@/lib/db';
import type { JsonSchema } from '@/lib/research/ai/schema';
import { getAIProvider } from '@/lib/research/ai/provider';
import { taxonomyLabel, type AnalysisEnumColumn } from '@/lib/research/taxonomy';
import {
  opportunityTypeLabel,
  type ReportInsight,
  type ReportJson,
  type ReportOpportunity,
  type ReportOpportunityEvidence,
  type ReportOverview,
  type ReportPatternStat,
  type ReportQuote,
  type ReportViralPatterns,
} from '@/lib/research/report-txt';

type Sql = ReturnType<typeof getDb>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ARRAY_OID = 2951;
export const REPORT_VERSION = 'v1';
export const PROMPT_VERSION = 'rep-v1';

const PATTERN_COLUMNS = [
  'hook_type',
  'topic_category',
  'content_structure',
  'content_format',
  'emotion',
  'cta_type',
] as const satisfies readonly AnalysisEnumColumn[];

const INSIGHT_CATEGORIES = [
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

type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

const NARRATIVE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['executive_summary', 'target_audience'],
  properties: {
    executive_summary: {
      type: 'string',
      minLength: 40,
      maxLength: 2000,
      description: '简体中文 5 到 8 句。只引用输入 JSON 里出现过的数字。',
    },
    target_audience: {
      type: 'object',
      additionalProperties: false,
      required: ['primary', 'secondary', 'state', 'why_watch'],
      properties: {
        primary: { type: 'string', minLength: 1, maxLength: 400 },
        secondary: { type: 'string', minLength: 1, maxLength: 400 },
        state: { type: 'string', minLength: 1, maxLength: 400 },
        why_watch: { type: 'string', minLength: 1, maxLength: 400 },
      },
    },
  },
};

const BANNED_PHRASES = ['内容有价值', '标题很吸引人', '抓住用户注意力'];

const NARRATIVE_SYSTEM = `你是研究内容情报报告编辑。只根据用户 JSON 中已经给出的事实和数字，用简体中文输出 JSON。
禁止编造输入里没有的数量、百分比、平台、人名、视频或案例。输入没有的类别就不要写成已经发现。
禁止出现这些套话，也不要换一种说法复述它们：内容有价值、标题很吸引人、抓住用户注意力。
executive_summary 写 5 到 8 句。必须使用 overview 里的项目名、主题、videos_collected、videos_analysed、high_potential。再点出输入中最突出的痛点、爆款模式和内容机会，并带上该条自己的 frequency_pct、count、pct 或 evidence 数字。数字只能原样来自输入。
target_audience.primary 是主要人群，依据 audience_segments 与 overview.target_market。
target_audience.secondary 是次级人群。输入不足以区分时写「输入未区分次级人群」，不要编造人群。
target_audience.state 是这群人所处的状态。
target_audience.why_watch 是他们为什么会看这类视频。
专有名词和枚举 key 可以保留原文。不要输出 Markdown。`;

export class ReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportInputError';
  }
}

export class ReportNotFoundError extends Error {
  constructor(message = 'Research run was not found') {
    super(message);
    this.name = 'ReportNotFoundError';
  }
}

export class ReportAIError extends Error {
  readonly report: ResearchReport;

  constructor(message: string, report: ResearchReport) {
    super(message);
    this.name = 'ReportAIError';
    this.report = report;
  }
}

export interface ResearchReport {
  id: string;
  research_run_id: string;
  project_id: string | null;
  report_version: string | null;
  model: string | null;
  prompt_version: string | null;
  report_json: ReportJson;
  executive_summary: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RunRow {
  id: string;
  project_id: string;
  topic: string;
  created_at: Date | string;
  name: string;
  target_audience: string | null;
  platforms: string[] | null;
}

interface InsightRow {
  category: string;
  title: string | null;
  description: string | null;
  surface_problem: string | null;
  underlying_problem: string | null;
  underlying_need: string | null;
  desired_outcome: string | null;
  need_kind: string | null;
  frequency_pct: number | string | null;
  evidence_count: number | string | null;
  high_potential_count: number | string | null;
  evidence_video_ids: string[] | null;
  supporting_quotes: unknown;
  confidence: string | null;
  observation_level: string | null;
  rank: number | string | null;
}

interface PatternRow {
  dimension: string;
  key: string;
  count: number | string;
}

interface HookRow {
  video_id: string;
  url: string | null;
  hook: string;
  viral_score: number | string | null;
}

interface WhyRow {
  video_id: string;
  url: string | null;
  author_handle: string | null;
  viral_score: number | string | null;
  why_it_works: string | null;
  reusable_pattern: string | null;
}

interface SourceRow {
  id: string;
  url: string | null;
  author_handle: string | null;
  platform: string | null;
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  saves: number | string | null;
  viral_score: number | string | null;
  summary: string | null;
}

interface OpportunityRow {
  id: string;
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
  evidence: unknown;
  evidence_video_ids: string[] | null;
}

interface NarrativeResult {
  executive_summary: string;
  target_audience: {
    primary: string;
    secondary: string;
    state: string;
    why_watch: string;
  };
}

interface ReportRow {
  id: string;
  research_run_id: string;
  project_id: string | null;
  report_version: string | null;
  model: string | null;
  prompt_version: string | null;
  report_json: unknown;
  executive_summary: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export async function getLatestResearchReport(runId: string): Promise<ResearchReport | null> {
  if (!UUID.test(runId)) throw new ReportInputError('Invalid run id');
  const sql = getDb();
  const rows = await sql<ReportRow[]>`
    select id, research_run_id, project_id, report_version, model, prompt_version,
           report_json, executive_summary, status, created_at, updated_at
    from research_reports
    where research_run_id = ${runId}
    order by created_at desc
    limit 1
  `;
  const row = rows[0];
  return row ? toReport(row) : null;
}

export async function generateResearchReport(runId: string): Promise<ResearchReport> {
  if (!UUID.test(runId)) throw new ReportInputError('Invalid run id');
  const sql = getDb();
  const runs = await sql<RunRow[]>`
    select r.id, r.project_id, r.topic, r.created_at, p.name, p.target_audience, p.platforms
    from research_runs r
    join projects p on p.id = r.project_id
    where r.id = ${runId}
    limit 1
  `;
  const run = runs[0];
  if (!run) throw new ReportNotFoundError();

  const reportJson = await assembleReport(sql, run);
  try {
    const ai = getAIProvider('intel');
    const result = await ai.completeJson<NarrativeResult>({
      task: 'research_report',
      system: NARRATIVE_SYSTEM,
      user: JSON.stringify(compactForModel(reportJson)),
      schemaName: 'research_report',
      schema: NARRATIVE_SCHEMA,
      maxTokens: 2500,
      timeoutMs: 120000,
      promptVersion: PROMPT_VERSION,
      inputSource: { run_id: runId },
    });
    const summary = clip(result.data.executive_summary, 2000);
    const audience = result.data.target_audience;
    assertNoBanned([summary, audience.primary, audience.secondary, audience.state, audience.why_watch]);
    if (!summary) throw new Error('AI executive summary was empty');
    reportJson.executive_summary = summary;
    reportJson.target_audience.primary = clip(audience.primary, 400);
    reportJson.target_audience.secondary = clip(audience.secondary, 400);
    reportJson.target_audience.state = clip(audience.state, 400);
    reportJson.target_audience.why_watch = clip(audience.why_watch, 400);
    return await insertReport(sql, {
      runId,
      projectId: run.project_id,
      model: result.model,
      reportJson,
      executiveSummary: summary,
      status: 'complete',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    reportJson.executive_summary = null;
    reportJson.target_audience.primary = null;
    reportJson.target_audience.secondary = null;
    reportJson.target_audience.state = null;
    reportJson.target_audience.why_watch = null;
    reportJson.errors = [message.slice(0, 2000)];
    let stored: ResearchReport;
    try {
      stored = await insertReport(sql, {
        runId,
        projectId: run.project_id,
        model: null,
        reportJson,
        executiveSummary: null,
        status: 'partial',
      });
    } catch (writeErr) {
      const writeMessage = writeErr instanceof Error ? writeErr.message : 'report store failed';
      throw new Error(`${message} (report store failed: ${writeMessage})`);
    }
    throw new ReportAIError(message, stored);
  }
}

async function assembleReport(sql: Sql, run: RunRow): Promise<ReportJson> {
  const [overview, insights, patterns, hooks, why, sources, opportunities] = await Promise.all([
    loadOverview(sql, run),
    loadInsights(sql, run.id),
    loadPatterns(sql, run.id),
    loadHooks(sql, run.id),
    loadWhy(sql, run.id),
    loadSources(sql, run.id),
    loadOpportunities(sql, run.project_id, run.id),
  ]);

  const urlMap = new Map<string, string | null>();
  for (const video of sources) urlMap.set(video.id, video.url);
  const extraIds = new Set<string>();
  for (const insight of insights) {
    for (const id of insight.evidence_video_ids) if (!urlMap.has(id)) extraIds.add(id);
    for (const quote of insight.supporting_quotes) if (quote.video_id && !urlMap.has(quote.video_id)) extraIds.add(quote.video_id);
  }
  for (const opportunity of opportunities) {
    for (const id of opportunity.evidence_video_ids ?? []) if (!urlMap.has(id)) extraIds.add(id);
  }
  if (extraIds.size) {
    const ids = Array.from(extraIds);
    const rows = await sql<{ id: string; url: string | null }[]>`
      select id, url from videos where id = any(${sql.array(ids, UUID_ARRAY_OID)})
    `;
    for (const row of rows) urlMap.set(row.id, row.url);
  }

  const grouped = groupInsights(insights, urlMap);
  const analysed = overview.videos_analysed;
  const viral = emptyPatterns();
  for (const row of patterns) {
    const column = PATTERN_COLUMNS.find((item) => item === row.dimension);
    if (!column) continue;
    const count = int(row.count);
    const stat: ReportPatternStat = {
      key: row.key,
      label: taxonomyLabel(column, row.key) ?? row.key,
      count,
      pct: percent(count, analysed),
    };
    pushPattern(viral, column, stat);
  }
  viral.top_hooks = hooks.map((row) => ({
    video_id: row.video_id,
    url: row.url,
    hook: row.hook,
    viral_score: num(row.viral_score),
  }));

  return {
    overview,
    executive_summary: null,
    target_audience: {
      primary: null,
      secondary: null,
      state: null,
      why_watch: null,
      segments: grouped.audience_segment,
    },
    pain_points: grouped.pain_point,
    desires: grouped.desire,
    needs: grouped.need,
    objections: grouped.objection,
    questions: grouped.question,
    emotional_triggers: grouped.emotional_trigger,
    misconceptions: grouped.misconception,
    jobs_to_be_done: grouped.job_to_be_done,
    conversion_signals: grouped.conversion_signal,
    viral_patterns: viral,
    why_content_works: why.map((row) => ({
      video_id: row.video_id,
      url: row.url,
      author: row.author_handle,
      viral_score: num(row.viral_score),
      why_it_works: row.why_it_works,
      reusable_pattern: row.reusable_pattern,
    })),
    content_gaps: grouped.content_gap,
    opportunities: opportunities.map((row) => toOpportunity(row, urlMap)),
    source_videos: sources.map((row) => ({
      id: row.id,
      url: row.url,
      author: row.author_handle,
      platform: row.platform,
      views: num(row.views),
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      saves: num(row.saves),
      viral_score: num(row.viral_score),
      summary: row.summary,
    })),
  };
}

async function loadOverview(sql: Sql, run: RunRow): Promise<ReportOverview> {
  const counts = await sql<{
    videos_collected: number | string | null;
    videos_analysed: number | string | null;
    high_potential: number | string | null;
    comments_collected: boolean | null;
  }[]>`
    select count(*)::int as videos_collected,
           count(a.video_id)::int as videos_analysed,
           count(*) filter (where rv.is_high_potential)::int as high_potential,
           coalesce(bool_or(
             (jsonb_typeof(v.raw->'comments') = 'array' and jsonb_array_length(v.raw->'comments') > 0)
             or (jsonb_typeof(v.raw->'comment_list') = 'array' and jsonb_array_length(v.raw->'comment_list') > 0)
             or (jsonb_typeof(v.raw->'commentList') = 'array' and jsonb_array_length(v.raw->'commentList') > 0)
             or (jsonb_typeof(v.raw->'commentsData') = 'array' and jsonb_array_length(v.raw->'commentsData') > 0)
             or (jsonb_typeof(v.raw->'comment_texts') = 'array' and jsonb_array_length(v.raw->'comment_texts') > 0)
           ), false) as comments_collected
    from research_run_videos rv
    join videos v on v.id = rv.video_id
    left join lateral (
      select a.video_id
      from video_analyses a
      where a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
      order by a.created_at desc nulls last, a.id desc
      limit 1
    ) a on true
    where rv.run_id = ${run.id}
  `;
  const platforms = await sql<{ platform: string }[]>`
    select distinct v.platform
    from research_run_videos rv
    join videos v on v.id = rv.video_id
    where rv.run_id = ${run.id}
      and v.platform is not null
      and btrim(v.platform) <> ''
    order by v.platform
  `;
  const count = counts[0];
  const fromVideos = platforms.map((row) => row.platform);
  return {
    project: run.name,
    topic: run.topic,
    target_market: run.target_audience,
    date: ymd(run.created_at),
    platforms: fromVideos.length ? fromVideos : (run.platforms ?? []),
    videos_collected: int(count?.videos_collected),
    videos_analysed: int(count?.videos_analysed),
    high_potential: int(count?.high_potential),
    comments_collected: Boolean(count?.comments_collected),
  };
}

async function loadInsights(sql: Sql, runId: string): Promise<ReportInsight[]> {
  const rows = await sql<InsightRow[]>`
    select category, title, description, surface_problem, underlying_problem,
           underlying_need, desired_outcome, need_kind,
           frequency_pct::float8 as frequency_pct,
           evidence_count::int as evidence_count,
           high_potential_count::int as high_potential_count,
           evidence_video_ids, supporting_quotes, confidence, observation_level,
           rank::int as rank
    from audience_insights
    where run_id = ${runId}
      and status = 'active'
    order by rank asc nulls last, evidence_count desc nulls last, title
  `;
  return rows.map((row) => ({
    category: row.category,
    title: row.title?.trim() || '（未命名）',
    description: row.description,
    surface_problem: row.surface_problem,
    underlying_problem: row.underlying_problem,
    underlying_need: row.underlying_need,
    desired_outcome: row.desired_outcome,
    need_kind: row.need_kind,
    frequency_pct: num(row.frequency_pct),
    evidence_count: int(row.evidence_count),
    high_potential_count: int(row.high_potential_count),
    evidence_video_ids: row.evidence_video_ids ?? [],
    evidence_video_urls: [],
    supporting_quotes: parseQuotes(row.supporting_quotes),
    confidence: row.confidence,
    observation_level: row.observation_level,
    rank: num(row.rank),
  }));
}

async function loadPatterns(sql: Sql, runId: string): Promise<PatternRow[]> {
  return sql<PatternRow[]>`
    with latest as (
      select distinct on (rv.video_id)
        a.hook_type, a.topic_category, a.content_structure, a.content_format, a.emotion, a.cta_type
      from research_run_videos rv
      join video_analyses a on a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
      where rv.run_id = ${runId}
      order by rv.video_id, a.created_at desc nulls last, a.id desc
    )
    select dim.dimension, dim.key, count(*)::int as count
    from latest
    cross join lateral (
      values
        ('hook_type', hook_type),
        ('topic_category', topic_category),
        ('content_structure', content_structure),
        ('content_format', content_format),
        ('emotion', emotion),
        ('cta_type', cta_type)
    ) as dim(dimension, key)
    where dim.key is not null and btrim(dim.key) <> ''
    group by dim.dimension, dim.key
    order by dim.dimension, count desc, dim.key
  `;
}

async function loadHooks(sql: Sql, runId: string): Promise<HookRow[]> {
  return sql<HookRow[]>`
    with latest as (
      select distinct on (rv.video_id)
        rv.video_id,
        rv.viral_score::float8 as viral_score,
        nullif(btrim(coalesce(a.hook, a.hook_text, '')), '') as hook
      from research_run_videos rv
      join video_analyses a on a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
      where rv.run_id = ${runId}
      order by rv.video_id, a.created_at desc nulls last, a.id desc
    )
    select l.video_id, v.url, l.hook, l.viral_score
    from latest l
    join videos v on v.id = l.video_id
    where l.hook is not null
    order by l.viral_score desc nulls last, l.video_id
    limit 10
  `;
}

async function loadWhy(sql: Sql, runId: string): Promise<WhyRow[]> {
  return sql<WhyRow[]>`
    with latest as (
      select distinct on (rv.video_id)
        rv.video_id,
        rv.viral_score::float8 as viral_score,
        nullif(btrim(coalesce(a.why_it_works, '')), '') as why_it_works,
        nullif(btrim(coalesce(a.reusable_pattern, '')), '') as reusable_pattern
      from research_run_videos rv
      join video_analyses a on a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
      where rv.run_id = ${runId}
      order by rv.video_id, a.created_at desc nulls last, a.id desc
    )
    select l.video_id, v.url, v.author_handle, l.viral_score, l.why_it_works, l.reusable_pattern
    from latest l
    join videos v on v.id = l.video_id
    where l.why_it_works is not null or l.reusable_pattern is not null
    order by l.viral_score desc nulls last, l.video_id
    limit 10
  `;
}

async function loadSources(sql: Sql, runId: string): Promise<SourceRow[]> {
  return sql<SourceRow[]>`
    select v.id, v.url, v.author_handle, v.platform,
           v.views::float8 as views,
           v.likes::float8 as likes,
           v.comments::float8 as comments,
           v.shares::float8 as shares,
           v.saves::float8 as saves,
           rv.viral_score::float8 as viral_score,
           a.summary
    from research_run_videos rv
    join videos v on v.id = rv.video_id
    left join lateral (
      select a.summary
      from video_analyses a
      where a.video_id = rv.video_id
        and a.is_latest = true
        and a.status = 'complete'
      order by a.created_at desc nulls last, a.id desc
      limit 1
    ) a on true
    where rv.run_id = ${runId}
    order by rv.viral_score desc nulls last, v.id
  `;
}

async function loadOpportunities(sql: Sql, projectId: string, runId: string): Promise<OpportunityRow[]> {
  return sql<OpportunityRow[]>`
    with run_ids as (
      select video_id from research_run_videos where run_id = ${runId}
    ),
    active as (
      select o.id, o.title, o.topic, o.target_audience, o.pain_point, o.recommended_hook,
             o.angle, o.content_structure, o.why_now, o.opportunity_type, o.platform_suggestion,
             o.evidence, o.evidence_video_ids, o.created_at
      from opportunities o
      where o.niche_id = ${projectId}
        and o.status = 'active'
    ),
    overlap as (
      select a.*
      from active a
      where a.evidence_video_ids && (select coalesce(array_agg(video_id), '{}'::uuid[]) from run_ids)
    )
    select id, title, topic, target_audience, pain_point, recommended_hook, angle,
           content_structure, why_now, opportunity_type, platform_suggestion,
           evidence, evidence_video_ids
    from (
      select * from overlap
      where exists (select 1 from overlap)
      union all
      select * from active
      where not exists (select 1 from overlap)
    ) picked
    order by picked.created_at desc
  `;
}

function groupInsights(insights: ReportInsight[], urlMap: Map<string, string | null>): Record<InsightCategory, ReportInsight[]> {
  const grouped = Object.fromEntries(INSIGHT_CATEGORIES.map((category) => [category, [] as ReportInsight[]])) as Record<InsightCategory, ReportInsight[]>;
  for (const insight of insights) {
    const category = INSIGHT_CATEGORIES.find((item) => item === insight.category);
    if (!category) continue;
    insight.evidence_video_urls = urlsFor(insight.evidence_video_ids, urlMap);
    insight.supporting_quotes = insight.supporting_quotes.map((quote) => ({
      ...quote,
      url: quote.video_id ? urlMap.get(quote.video_id) ?? quote.url : quote.url,
    }));
    grouped[category].push(insight);
  }
  return grouped;
}

function toOpportunity(row: OpportunityRow, urlMap: Map<string, string | null>): ReportOpportunity {
  const ids = row.evidence_video_ids ?? [];
  const structureLabel = row.content_structure ? taxonomyLabel('content_structure', row.content_structure) : null;
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    target_audience: row.target_audience,
    pain_point: row.pain_point,
    recommended_hook: row.recommended_hook,
    angle: row.angle,
    content_structure: row.content_structure,
    content_structure_label: structureLabel ?? row.content_structure,
    why_now: row.why_now,
    opportunity_type: row.opportunity_type,
    opportunity_type_label: opportunityTypeLabel(row.opportunity_type),
    platform_suggestion: row.platform_suggestion,
    evidence: parseEvidence(row.evidence),
    related_video_urls: urlsFor(ids, urlMap),
  };
}

async function insertReport(
  sql: Sql,
  input: {
    runId: string;
    projectId: string;
    model: string | null;
    reportJson: ReportJson;
    executiveSummary: string | null;
    status: 'complete' | 'partial';
  },
): Promise<ResearchReport> {
  const rows = await sql<ReportRow[]>`
    insert into research_reports (
      research_run_id, project_id, report_version, model, prompt_version,
      report_json, executive_summary, status
    ) values (
      ${input.runId},
      ${input.projectId},
      ${REPORT_VERSION},
      ${input.model},
      ${PROMPT_VERSION},
      ${sql.json(input.reportJson as never)},
      ${input.executiveSummary},
      ${input.status}
    )
    returning id, research_run_id, project_id, report_version, model, prompt_version,
              report_json, executive_summary, status, created_at, updated_at
  `;
  const row = rows[0];
  if (!row) throw new Error('Could not store the research report');
  return toReport(row);
}

function toReport(row: ReportRow): ResearchReport {
  return {
    id: row.id,
    research_run_id: row.research_run_id,
    project_id: row.project_id,
    report_version: row.report_version,
    model: row.model,
    prompt_version: row.prompt_version,
    report_json: parseStoredJson(row.report_json),
    executive_summary: row.executive_summary,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function compactForModel(report: ReportJson): Record<string, unknown> {
  return {
    overview: report.overview,
    audience_segments: report.target_audience.segments.map(compactInsight),
    pain_points: report.pain_points.map(compactInsight),
    desires: report.desires.map(compactInsight),
    needs: report.needs.map(compactInsight),
    objections: report.objections.map(compactInsight),
    questions: report.questions.map(compactInsight),
    emotional_triggers: report.emotional_triggers.map(compactInsight),
    misconceptions: report.misconceptions.map(compactInsight),
    jobs_to_be_done: report.jobs_to_be_done.map(compactInsight),
    conversion_signals: report.conversion_signals.map(compactInsight),
    content_gaps: report.content_gaps.map(compactInsight),
    viral_patterns: {
      hook_types: report.viral_patterns.hook_types,
      topics: report.viral_patterns.topics,
      structures: report.viral_patterns.structures,
      formats: report.viral_patterns.formats,
      emotions: report.viral_patterns.emotions,
      cta_types: report.viral_patterns.cta_types,
      top_hooks: report.viral_patterns.top_hooks.map((hook) => ({
        hook: clip(hook.hook, 180),
        viral_score: hook.viral_score,
      })),
    },
    why_content_works: report.why_content_works.map((item) => ({
      viral_score: item.viral_score,
      why_it_works: clip(item.why_it_works, 240),
      reusable_pattern: clip(item.reusable_pattern, 240),
    })),
    opportunities: report.opportunities.map((item) => ({
      title: item.title,
      target_audience: item.target_audience,
      pain_point: item.pain_point,
      topic: item.topic,
      recommended_hook: clip(item.recommended_hook, 180),
      angle: clip(item.angle, 180),
      why_now: clip(item.why_now, 240),
      evidence: item.evidence,
    })),
    source_video_count: report.source_videos.length,
  };
}

function compactInsight(item: ReportInsight): Record<string, unknown> {
  return {
    title: item.title,
    description: clip(item.description, 320),
    surface_problem: clip(item.surface_problem, 200),
    underlying_problem: clip(item.underlying_problem, 200),
    underlying_need: clip(item.underlying_need, 200),
    desired_outcome: clip(item.desired_outcome, 200),
    need_kind: item.need_kind,
    frequency_pct: item.frequency_pct,
    evidence_count: item.evidence_count,
    high_potential_count: item.high_potential_count,
    confidence: item.confidence,
    observation_level: item.observation_level,
  };
}

function parseQuotes(value: unknown): ReportQuote[] {
  if (!Array.isArray(value)) return [];
  const quotes: ReportQuote[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const videoId = typeof record.video_id === 'string' ? record.video_id : '';
    const quote = typeof record.quote === 'string' ? record.quote.trim() : '';
    if (!quote) continue;
    quotes.push({ video_id: videoId, quote, url: null });
  }
  return quotes;
}

function parseEvidence(value: unknown): ReportOpportunityEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    matching_videos: num(record.matching_videos),
    high_potential: num(record.high_potential),
    avg_viral_score: num(record.avg_viral_score),
    outlier_3x: num(record.outlier_3x),
    outlier_8x: num(record.outlier_8x),
  };
}

function parseStoredJson(value: unknown): ReportJson {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== 'object') throw new Error('Stored report_json is invalid');
  return parsed as ReportJson;
}

function urlsFor(ids: string[], urlMap: Map<string, string | null>): string[] {
  const urls: string[] = [];
  for (const id of ids) {
    const url = urlMap.get(id);
    if (url) urls.push(url);
  }
  return urls;
}

function pushPattern(viral: ReportViralPatterns, column: (typeof PATTERN_COLUMNS)[number], stat: ReportPatternStat): void {
  if (column === 'hook_type') viral.hook_types.push(stat);
  else if (column === 'topic_category') viral.topics.push(stat);
  else if (column === 'content_structure') viral.structures.push(stat);
  else if (column === 'content_format') viral.formats.push(stat);
  else if (column === 'emotion') viral.emotions.push(stat);
  else viral.cta_types.push(stat);
}

function emptyPatterns(): ReportViralPatterns {
  return {
    hook_types: [],
    topics: [],
    structures: [],
    formats: [],
    emotions: [],
    cta_types: [],
    top_hooks: [],
  };
}

function percent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown): number {
  const parsed = num(value);
  return parsed == null ? 0 : Math.round(parsed);
}

function assertNoBanned(parts: Array<string | null>): void {
  const text = parts.filter(Boolean).join('\n');
  for (const phrase of BANNED_PHRASES) {
    if (text.includes(phrase)) throw new Error(`AI report used a banned phrase: ${phrase}`);
  }
}

function clip(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function ymd(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
