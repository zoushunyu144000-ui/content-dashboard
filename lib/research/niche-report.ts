import 'server-only';
import { getDb } from '@/lib/db';
import { getNiche } from '@/lib/research/niches';
import { OPPORTUNITY_TYPE_LABELS, taxonomyLabel, type AnalysisEnumColumn } from '@/lib/research/taxonomy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ARRAY_OID = 2951;
const EMPTY = '（本次无数据）';
const MISSING = '（未提供）';

const AUDIENCE_SECTIONS: { title: string; categories: string[] }[] = [
  { title: '3. Audience Segments 受众分段', categories: ['audience_segment'] },
  { title: '4. Pain Points 痛点', categories: ['pain_point'] },
  { title: '5. Needs and Desires 需求与欲望', categories: ['need', 'desire'] },
  { title: '6. Objections 异议', categories: ['objection'] },
  { title: '7. Questions 问题', categories: ['question'] },
  { title: '8. Emotional Triggers 情绪触发', categories: ['emotional_trigger'] },
  { title: '9. Misconceptions 误解', categories: ['misconception'] },
  { title: '10. Jobs To Be Done 待完成工作', categories: ['job_to_be_done'] },
  { title: '11. Content Gaps 内容缺口', categories: ['content_gap'] },
  { title: '12. Conversion Signals 转化信号', categories: ['conversion_signal'] },
];

const CATEGORY_LABEL: Record<string, string> = {
  audience_segment: '受众分段',
  pain_point: '痛点',
  need: '需求',
  desire: '欲望',
  objection: '异议',
  question: '问题',
  emotional_trigger: '情绪触发',
  misconception: '误解',
  job_to_be_done: '待完成工作',
  content_gap: '内容缺口',
  conversion_signal: '转化信号',
};

const PATTERN_DIMENSIONS = [
  'hook_type',
  'topic_category',
  'content_structure',
  'content_format',
  'emotion',
  'cta_type',
  'pain_point_category',
] as const satisfies readonly AnalysisEnumColumn[];

const PATTERN_TITLES: Record<(typeof PATTERN_DIMENSIONS)[number], string> = {
  hook_type: 'Hook Types 钩子类型',
  topic_category: 'Topics 话题',
  content_structure: 'Structures 结构',
  content_format: 'Formats 形式',
  emotion: 'Emotions 情绪',
  cta_type: 'CTA Patterns 行动号召',
  pain_point_category: 'Pain Point Categories 痛点类别',
};

const EVIDENCE_NUMBER_KEYS = [
  'matching_videos',
  'high_potential',
  'avg_viral_score',
  'outlier_3x',
  'outlier_8x',
  'total_views',
] as const;

export class ProjectReportNotFoundError extends Error {
  constructor() {
    super('Niche was not found');
    this.name = 'ProjectReportNotFoundError';
  }
}

export interface ProjectReportFile {
  filename: string;
  body: string;
}

interface RunRow {
  id: string;
  topic: string;
  created_at: Date | string;
  videos: number | string | null;
  analysed: number | string | null;
}

interface TotalRow {
  videos: number | string | null;
  analysed: number | string | null;
  high_potential: number | string | null;
}

interface SummaryRow {
  topic: string;
  created_at: Date | string;
  executive_summary: string | null;
}

interface InsightRow {
  category: string;
  title: string;
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
  confidence: string | null;
  observation_level: string | null;
  run_topic: string | null;
}

interface PatternRow {
  dimension: string;
  key: string;
  count: number | string | null;
  total: number | string | null;
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
  evidence: unknown;
  evidence_video_ids: string[] | null;
  ai_task_run_id: string | null;
  status: string;
  created_at: Date | string;
}

interface VideoRow {
  url: string | null;
  author_name: string | null;
  author_handle: string | null;
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  saves: number | string | null;
  viral_score: number | string | null;
  ai_summary: string | null;
}

export function projectReportFilename(slug: string, date: string): string {
  const safe = slug
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  return `${safe}-project-report-${day}.txt`;
}

export async function buildProjectReportTxt(projectId: string): Promise<ProjectReportFile> {
  const sql = getDb();
  const [niche, runs, totals, summaries, insights, patterns, opportunities, videos] = await Promise.all([
    getNiche(projectId),
    sql<RunRow[]>`
      select r.id, r.topic, r.created_at,
             (select count(*)::int from research_run_videos rv where rv.run_id = r.id) as videos,
             (
               select count(*)::int
               from research_run_videos rv
               where rv.run_id = r.id
                 and exists (
                   select 1
                   from video_analyses a
                   where a.video_id = rv.video_id
                     and a.is_latest = true
                     and a.status = 'complete'
                 )
             ) as analysed
      from research_runs r
      where r.project_id = ${projectId}
      order by r.created_at desc, r.id
    `,
    sql<TotalRow[]>`
      select count(distinct rv.video_id)::int as videos,
             count(distinct rv.video_id) filter (
               where exists (
                 select 1
                 from video_analyses a
                 where a.video_id = rv.video_id
                   and a.is_latest = true
                   and a.status = 'complete'
               )
             )::int as analysed,
             count(distinct rv.video_id) filter (where rv.is_high_potential)::int as high_potential
      from research_run_videos rv
      join research_runs r on r.id = rv.run_id
      where r.project_id = ${projectId}
    `,
    sql<SummaryRow[]>`
      select r.topic, r.created_at, s.executive_summary
      from research_runs r
      join lateral (
        select executive_summary
        from research_reports
        where research_run_id = r.id
        order by created_at desc, id desc
        limit 1
      ) s on true
      where r.project_id = ${projectId}
      order by r.created_at desc, r.id
    `,
    sql<InsightRow[]>`
      select i.category, i.title, i.description, i.surface_problem, i.underlying_problem,
             i.underlying_need, i.desired_outcome, i.need_kind,
             i.frequency_pct::float8 as frequency_pct,
             i.evidence_count::int as evidence_count,
             i.high_potential_count::int as high_potential_count,
             i.evidence_video_ids, i.confidence, i.observation_level,
             r.topic as run_topic
      from audience_insights i
      left join research_runs r on r.id = i.run_id
      where i.status = 'active'
        and (i.niche_id = ${projectId} or r.project_id = ${projectId})
      order by i.evidence_count desc nulls last, i.high_potential_count desc nulls last, i.title, i.id
    `,
    sql<PatternRow[]>`
      with latest as (
        select distinct on (a.video_id)
          a.hook_type, a.topic_category, a.content_structure, a.content_format,
          a.emotion, a.cta_type, a.pain_point_category
        from video_analyses a
        where a.niche_id = ${projectId}
          and a.is_latest = true
          and a.status = 'complete'
        order by a.video_id, a.created_at desc nulls last, a.id desc
      ),
      counted as (
        select dim.dimension, dim.key, count(*)::int as count
        from latest
        cross join lateral (
          values
            ('hook_type', hook_type),
            ('topic_category', topic_category),
            ('content_structure', content_structure),
            ('content_format', content_format),
            ('emotion', emotion),
            ('cta_type', cta_type),
            ('pain_point_category', pain_point_category)
        ) as dim(dimension, key)
        where dim.key is not null and btrim(dim.key) <> ''
        group by dim.dimension, dim.key
      )
      select dimension, key, count, (select count(*)::int from latest) as total
      from counted
      union all
      select '' as dimension, '' as key, 0 as count, (select count(*)::int from latest) as total
      where not exists (select 1 from counted)
    `,
    sql<OpportunityRow[]>`
      select id, niche_id, run_id, title, topic, target_audience, pain_point,
             recommended_hook, angle, content_structure, why_now, opportunity_type,
             platform_suggestion, evidence, evidence_video_ids, ai_task_run_id, status, created_at
      from opportunities
      where niche_id = ${projectId}
        and status = 'active'
      order by created_at desc, id
    `,
    sql<VideoRow[]>`
      with scored as (
        select distinct on (rv.video_id)
          rv.video_id,
          rv.viral_score
        from research_run_videos rv
        join research_runs r on r.id = rv.run_id
        where r.project_id = ${projectId}
        order by rv.video_id, rv.viral_score desc nulls last, rv.id
      )
      select v.url, v.author_name, v.author_handle,
             v.views, v.likes, v.comments, v.shares, v.saves,
             s.viral_score::float8 as viral_score,
             coalesce(nullif(btrim(a.summary), ''), nullif(btrim(a.why_it_works), '')) as ai_summary
      from scored s
      join videos v on v.id = s.video_id
      left join lateral (
        select a.summary, a.why_it_works
        from video_analyses a
        where a.video_id = s.video_id
          and a.is_latest = true
          and a.status = 'complete'
        order by a.created_at desc nulls last, a.id desc
        limit 1
      ) a on true
      order by s.viral_score desc nulls last, v.id
    `,
  ]);

  if (!niche) throw new ProjectReportNotFoundError();

  const urlMap = await loadUrls(sql, insights, opportunities);
  const day = new Date().toISOString().slice(0, 10);
  const body = render({
    niche,
    runs,
    totals: totals[0] ?? { videos: 0, analysed: 0, high_potential: 0 },
    summaries,
    insights,
    patterns,
    opportunities,
    videos,
    urlMap,
  });
  return { filename: projectReportFilename(niche.slug, day), body };
}

async function loadUrls(
  sql: ReturnType<typeof getDb>,
  insights: InsightRow[],
  opportunities: OpportunityRow[],
): Promise<Map<string, string | null>> {
  const ids = new Set<string>();
  for (const row of insights) for (const id of uuidList(row.evidence_video_ids)) ids.add(id);
  for (const row of opportunities) for (const id of uuidList(row.evidence_video_ids)) ids.add(id);
  const map = new Map<string, string | null>();
  if (ids.size === 0) return map;
  const rows = await sql<{ id: string; url: string | null }[]>`
    select id::text as id, url
    from videos
    where id = any(${sql.array(Array.from(ids), UUID_ARRAY_OID)})
  `;
  for (const row of rows) map.set(row.id.toLowerCase(), row.url);
  return map;
}

function render(input: {
  niche: NonNullable<Awaited<ReturnType<typeof getNiche>>>;
  runs: RunRow[];
  totals: TotalRow;
  summaries: SummaryRow[];
  insights: InsightRow[];
  patterns: PatternRow[];
  opportunities: OpportunityRow[];
  videos: VideoRow[];
  urlMap: Map<string, string | null>;
}): string {
  const sections = [
    sectionPreface(),
    sectionOverview(input.niche, input.runs, input.totals),
    sectionSummaries(input.summaries),
    ...AUDIENCE_SECTIONS.map((block) => sectionInsights(block.title, input.insights, block.categories, input.urlMap)),
    sectionPatterns(input.patterns),
    sectionOpportunities(input.opportunities, input.urlMap),
    sectionVideos(input.videos),
  ];
  return `${sections.join('\n\n')}\n`;
}

function sectionPreface(): string {
  return [
    '0. Preface 前言',
    'This file is a plain-text project report for another AI. It is UTF-8 text, not HTML, and it is not a webpage.',
    '本文件是给另一个 AI 阅读的项目级研究报告，纯 UTF-8 文本，没有 HTML。',
    'It aggregates every research run of one project (research_runs.project_id). No model was called to write this file. Copy numbers only from the lines below.',
    '它汇总该项目下的全部研究运行。生成本文件时没有调用模型。数字只取自下面各节，不要补造。',
    'Sections 章节: 0 preface; 1 project overview (profile, runs, SQL totals); 2 latest executive summary per run; 3-12 active audience insights (section 5 merges need and desire); 13 viral pattern counts and percents from the latest complete video analyses of this niche; 14 active content opportunities; 15 source videos (union of run videos, best viral score first).',
    `An empty section is exactly this line: ${EMPTY}`,
  ].join('\n');
}

function sectionOverview(
  niche: NonNullable<Awaited<ReturnType<typeof getNiche>>>,
  runs: RunRow[],
  totals: TotalRow,
): string {
  const keywords = niche.search_keywords.map((item) => item.trim()).filter(Boolean);
  const lines = [
    '1. Project Overview 项目概览',
    `Name 名称: ${show(niche.name)}`,
    `Target Audience 目标受众: ${show(niche.target_audience)}`,
    `Core Business 核心业务: ${show(niche.core_business)}`,
    `Content Goal 内容目标: ${show(niche.content_goal)}`,
    `Search Keywords 搜索关键词: ${keywords.length ? keywords.join(', ') : MISSING}`,
    'Runs 研究运行:',
  ];
  if (runs.length === 0) {
    lines.push(EMPTY);
  } else {
    for (const run of runs) {
      lines.push(`- ${ymd(run.created_at)} | ${oneLine(run.topic)} | videos ${fmtInt(run.videos)} | analysed ${fmtInt(run.analysed)}`);
    }
  }
  lines.push('Totals 合计 (SQL, distinct videos across this project\'s runs):');
  lines.push(`Videos 视频: ${fmtInt(totals.videos)}`);
  lines.push(`Analysed 已分析: ${fmtInt(totals.analysed)}`);
  lines.push(`High Potential 高潜力: ${fmtInt(totals.high_potential)}`);
  lines.push('Analysed counts a run video when a status=complete and is_latest video analysis exists. High potential counts a video once if any run row has is_high_potential.');
  return lines.join('\n');
}

function sectionSummaries(rows: SummaryRow[]): string {
  const usable = rows.filter((row) => textOrNull(row.executive_summary));
  if (usable.length === 0) return section('2. Executive Summary 执行摘要', EMPTY);
  const body = usable.map((row) => [
    `Topic 话题: ${oneLine(row.topic)} (${ymd(row.created_at)})`,
    textOrNull(row.executive_summary) || EMPTY,
  ].join('\n')).join('\n\n');
  return section('2. Executive Summary 执行摘要', body);
}

function sectionInsights(
  title: string,
  rows: InsightRow[],
  categories: string[],
  urlMap: Map<string, string | null>,
): string {
  const list = rows.filter((row) => categories.includes(row.category));
  if (list.length === 0) return section(title, EMPTY);
  const body = list.map((row, index) => formatInsight(row, index, urlMap)).join('\n\n');
  return section(title, body);
}

function formatInsight(row: InsightRow, index: number, urlMap: Map<string, string | null>): string {
  const category = CATEGORY_LABEL[row.category] ? `${row.category} ${CATEGORY_LABEL[row.category]}` : row.category;
  const urls = urlsFor(row.evidence_video_ids, urlMap);
  const lines = [
    `[${index + 1}] ${oneLine(row.title)}`,
    `Category 类别: ${category}`,
    `Description 说明: ${show(row.description)}`,
    `Surface → Underlying → Need → Outcome 表面问题 → 底层问题 → 底层需求 → 期望结果: ${show(row.surface_problem)} → ${show(row.underlying_problem)} → ${show(row.underlying_need)} → ${show(row.desired_outcome)}`,
    row.need_kind ? `Need Kind 需求类型: ${row.need_kind}` : null,
    `Evidence Count 证据条数: ${fmtInt(row.evidence_count)}`,
    `High Potential Count 高潜条数: ${fmtInt(row.high_potential_count)}`,
    `Frequency 频率: ${fmtPct(row.frequency_pct)}`,
    `Confidence 置信度: ${show(row.confidence)}`,
    `Observation Level 观察层级: ${show(row.observation_level)}`,
    `Run Topic 所属话题: ${show(row.run_topic)}`,
    'Evidence Video URLs 证据视频:',
    urls.length ? urls.map((url) => `- ${url}`).join('\n') : '- （无视频 URL）',
  ];
  return lines.filter((line) => line != null).join('\n');
}

function sectionPatterns(rows: PatternRow[]): string {
  const total = int(rows[0]?.total);
  if (total <= 0) return section('13. Viral Content Patterns 爆款内容模式', EMPTY);
  const lines = [
    '13. Viral Content Patterns 爆款内容模式',
    `Denominator 分母: ${total} latest complete video analyses for this niche (video_analyses.niche_id, is_latest, status=complete, one row per video).`,
    'Percent 百分比 = count / denominator. Labels come from taxonomy *_LABELS.',
  ];
  for (const dimension of PATTERN_DIMENSIONS) {
    const stats = rows
      .filter((row) => row.dimension === dimension)
      .sort((a, b) => int(b.count) - int(a.count) || a.key.localeCompare(b.key));
    lines.push('');
    lines.push(PATTERN_TITLES[dimension]);
    if (stats.length === 0) {
      lines.push(EMPTY);
      continue;
    }
    for (const stat of stats) {
      const label = taxonomyLabel(dimension, stat.key) ?? stat.key;
      const count = int(stat.count);
      lines.push(`- ${label} (${stat.key}): ${count} (${fmtPct(percent(count, total))})`);
    }
  }
  return lines.join('\n');
}

function sectionOpportunities(rows: OpportunityRow[], urlMap: Map<string, string | null>): string {
  if (rows.length === 0) return section('14. Content Opportunities 内容机会', EMPTY);
  const body = rows.map((row, index) => formatOpportunity(row, index, urlMap)).join('\n\n');
  return section('14. Content Opportunities 内容机会', body);
}

function formatOpportunity(row: OpportunityRow, index: number, urlMap: Map<string, string | null>): string {
  const structureLabel = row.content_structure ? taxonomyLabel('content_structure', row.content_structure) : null;
  const typeLabel = row.opportunity_type
    ? (OPPORTUNITY_TYPE_LABELS as Record<string, string>)[row.opportunity_type] ?? null
    : null;
  const urls = urlsFor(row.evidence_video_ids, urlMap);
  return [
    `[${index + 1}] ${oneLine(row.title)}`,
    `id: ${row.id}`,
    `niche_id: ${row.niche_id}`,
    `run_id: ${show(row.run_id)}`,
    `status: ${show(row.status)}`,
    `created_at: ${ymd(row.created_at)}`,
    `ai_task_run_id: ${show(row.ai_task_run_id)}`,
    `Topic 话题: ${show(row.topic)}`,
    `Target Audience 目标受众: ${show(row.target_audience)}`,
    `Pain Point 痛点: ${show(row.pain_point)}`,
    `Recommended Hook 推荐钩子: ${show(row.recommended_hook)}`,
    `Angle 角度: ${show(row.angle)}`,
    `Content Structure 结构: ${structureLabel ? `${structureLabel} (${row.content_structure})` : show(row.content_structure)}`,
    `Why Now 为何现在: ${show(row.why_now)}`,
    `Opportunity Type 机会类型: ${typeLabel ? `${typeLabel} (${row.opportunity_type})` : show(row.opportunity_type)}`,
    `Platform Suggestion 平台建议: ${show(row.platform_suggestion)}`,
    'Evidence 证据:',
    evidenceLines(row.evidence).map((line) => `- ${line}`).join('\n'),
    'Evidence Video URLs 证据视频:',
    urls.length ? urls.map((url) => `- ${url}`).join('\n') : '- （无视频 URL）',
  ].join('\n');
}

function sectionVideos(rows: VideoRow[]): string {
  if (rows.length === 0) return section('15. Source Videos 来源视频', EMPTY);
  const body = rows.map((row, index) => [
    `[${index + 1}]`,
    `URL: ${textOrNull(row.url) || '（无视频 URL）'}`,
    `Author 作者: ${authorLabel(row.author_name, row.author_handle)}`,
    `Views 播放: ${fmtInt(row.views)}`,
    `Likes 点赞: ${fmtInt(row.likes)}`,
    `Comments 评论: ${fmtInt(row.comments)}`,
    `Shares 分享: ${fmtInt(row.shares)}`,
    `Saves 收藏: ${fmtInt(row.saves)}`,
    `Viral Score 爆款分: ${fmtScore(row.viral_score)}`,
    `AI Summary 分析摘要: ${show(row.ai_summary)}`,
  ].join('\n')).join('\n\n');
  return section('15. Source Videos 来源视频', body);
}

function evidenceLines(evidence: unknown): string[] {
  const record = evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    ? evidence as Record<string, unknown>
    : null;
  if (!record) return [MISSING];
  const lines = EVIDENCE_NUMBER_KEYS.map((key) => `${key}: ${fmtEvidence(record[key])}`);
  if ('criteria' in record) {
    lines.push(`criteria: ${record.criteria == null ? MISSING : JSON.stringify(record.criteria)}`);
  }
  for (const [key, value] of Object.entries(record)) {
    if ((EVIDENCE_NUMBER_KEYS as readonly string[]).includes(key) || key === 'criteria') continue;
    lines.push(`${key}: ${value != null && typeof value === 'object' ? JSON.stringify(value) : fmtEvidence(value)}`);
  }
  return lines;
}

function urlsFor(ids: string[] | null, urlMap: Map<string, string | null>): string[] {
  const lines: string[] = [];
  for (const id of uuidList(ids)) {
    const url = urlMap.get(id.toLowerCase());
    lines.push(textOrNull(url) || `（无视频 URL） ${id}`);
  }
  return lines;
}

function uuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && UUID.test(item));
}

function section(title: string, body: string): string {
  return `${title}\n${body}`;
}

function show(value: string | null | undefined): string {
  return textOrNull(value) ?? MISSING;
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function oneLine(value: string | null | undefined): string {
  const text = textOrNull(value);
  if (!text) return MISSING;
  return text.replace(/\s+/g, ' ');
}

function authorLabel(name: string | null, handle: string | null): string {
  const person = textOrNull(name);
  const raw = textOrNull(handle);
  const at = raw ? (raw.startsWith('@') ? raw : `@${raw}`) : null;
  if (person && at && person !== raw) return `${person} (${at})`;
  return person || at || MISSING;
}

function ymd(value: Date | string | null | undefined): string {
  if (!value) return MISSING;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toISOString().slice(0, 10);
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

function fmtInt(value: unknown): string {
  if (value == null || value === '') return MISSING;
  const parsed = num(value);
  if (parsed == null) return String(value);
  return String(Math.round(parsed));
}

function fmtScore(value: unknown): string {
  const parsed = num(value);
  if (parsed == null) return MISSING;
  return String(Math.round(parsed * 10) / 10);
}

function fmtPct(value: unknown): string {
  const parsed = num(value);
  if (parsed == null) return MISSING;
  return `${Math.round(parsed * 10) / 10}%`;
}

function fmtEvidence(value: unknown): string {
  if (value == null || value === '') return MISSING;
  if (typeof value === 'number') return fmtScore(value);
  if (typeof value === 'string') {
    const parsed = num(value);
    return parsed == null ? value : fmtScore(parsed);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}

function percent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}
