import { OPPORTUNITY_TYPE_LABELS } from '@/lib/research/taxonomy';

export interface ReportPatternStat {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface ReportQuote {
  video_id: string;
  quote: string;
  url: string | null;
  source?: string | null;
}

export interface ReportCommentSnippet {
  text: string;
  likes: number | null;
}

export interface ReportInsight {
  category: string;
  title: string;
  description: string | null;
  surface_problem: string | null;
  underlying_problem: string | null;
  underlying_need: string | null;
  desired_outcome: string | null;
  need_kind: string | null;
  frequency_pct: number | null;
  evidence_count: number;
  high_potential_count: number;
  evidence_video_ids: string[];
  evidence_video_urls: string[];
  supporting_quotes: ReportQuote[];
  confidence: string | null;
  observation_level: string | null;
  rank: number | null;
}

export interface ReportHook {
  video_id: string;
  url: string | null;
  hook: string;
  viral_score: number | null;
}

export interface ReportWhy {
  video_id: string;
  url: string | null;
  author: string | null;
  viral_score: number | null;
  why_it_works: string | null;
  reusable_pattern: string | null;
}

export interface ReportOpportunityEvidence {
  matching_videos: number | null;
  high_potential: number | null;
  avg_viral_score: number | null;
  outlier_3x: number | null;
  outlier_8x: number | null;
}

export interface ReportOpportunity {
  id: string;
  title: string;
  topic: string | null;
  target_audience: string | null;
  pain_point: string | null;
  recommended_hook: string | null;
  angle: string | null;
  content_structure: string | null;
  content_structure_label: string | null;
  why_now: string | null;
  opportunity_type: string | null;
  opportunity_type_label: string | null;
  platform_suggestion: string | null;
  evidence: ReportOpportunityEvidence | null;
  related_video_urls: string[];
}

export interface ReportSourceVideo {
  id: string;
  url: string | null;
  author: string | null;
  platform: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  viral_score: number | null;
  summary: string | null;
  top_comments?: ReportCommentSnippet[];
}

export interface ReportAudienceNarrative {
  primary: string | null;
  secondary: string | null;
  state: string | null;
  why_watch: string | null;
  segments: ReportInsight[];
}

export interface ReportOverview {
  project: string;
  topic: string;
  target_market: string | null;
  date: string;
  platforms: string[];
  videos_collected: number;
  videos_analysed: number;
  high_potential: number;
  comments_collected: boolean;
  comment_count?: number;
  comment_video_count?: number;
}

export interface ReportViralPatterns {
  hook_types: ReportPatternStat[];
  topics: ReportPatternStat[];
  structures: ReportPatternStat[];
  formats: ReportPatternStat[];
  emotions: ReportPatternStat[];
  cta_types: ReportPatternStat[];
  top_hooks: ReportHook[];
}

export interface ReportJson {
  overview: ReportOverview;
  executive_summary?: string | null;
  target_audience: ReportAudienceNarrative;
  pain_points: ReportInsight[];
  desires: ReportInsight[];
  needs: ReportInsight[];
  objections: ReportInsight[];
  questions: ReportInsight[];
  emotional_triggers: ReportInsight[];
  misconceptions: ReportInsight[];
  jobs_to_be_done: ReportInsight[];
  conversion_signals: ReportInsight[];
  viral_patterns: ReportViralPatterns;
  why_content_works: ReportWhy[];
  content_gaps: ReportInsight[];
  opportunities: ReportOpportunity[];
  source_videos: ReportSourceVideo[];
  errors?: string[];
}

const NO_DATA = '（本次无数据）';
const COMMENTS_MISSING = '评论未采集，证据来自字幕/文案/转写与视频分析';

const PATTERN_BLOCKS: { key: keyof ReportViralPatterns; title: string; empty: string }[] = [
  { key: 'hook_types', title: 'Hook Types 钩子类型', empty: '已完成分析中没有 hook_type。' },
  { key: 'topics', title: 'Topics 话题', empty: '已完成分析中没有 topic_category。' },
  { key: 'structures', title: 'Structures 结构', empty: '已完成分析中没有 content_structure。' },
  { key: 'formats', title: 'Formats 形式', empty: '已完成分析中没有 content_format。' },
  { key: 'emotions', title: 'Emotions 情绪', empty: '已完成分析中没有 emotion。' },
  { key: 'cta_types', title: 'CTA Patterns 行动号召', empty: '已完成分析中没有 cta_type。' },
];

export function researchReportFilename(topic: string, date: string): string {
  const slug = topic
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'research';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'undated';
  return `${slug}-research-${day}.txt`;
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function renderReportTxt(reportJson: ReportJson, executiveSummary: string | null): string {
  const report = reportJson;
  const summary = textOrNull(executiveSummary) ?? textOrNull(report.executive_summary);
  const sections = [
    sectionOverview(report.overview),
    section('2. Executive Summary 执行摘要', summary ? summary : empty('模型未返回执行摘要。报告 status 为 partial 时，错误记在 report_json.errors。')),
    sectionAudience(report.target_audience),
    sectionInsights('4. Audience Pain Points 受众痛点', report.pain_points, 'audience_insights 中没有 status=active 的 pain_point。'),
    sectionInsights('5. Desires 欲望', report.desires, 'audience_insights 中没有 status=active 的 desire。'),
    sectionNeeds(report.needs),
    sectionInsights('7. Objections 异议', report.objections, 'audience_insights 中没有 status=active 的 objection。'),
    sectionInsights('8. Questions 问题', report.questions, 'audience_insights 中没有 status=active 的 question。'),
    sectionInsights('9. Emotional Triggers 情绪触发', report.emotional_triggers, 'audience_insights 中没有 status=active 的 emotional_trigger。'),
    sectionInsights('10. Misconceptions 误解', report.misconceptions, 'audience_insights 中没有 status=active 的 misconception。'),
    sectionInsights('11. Jobs To Be Done 待完成工作', report.jobs_to_be_done, 'audience_insights 中没有 status=active 的 job_to_be_done。'),
    sectionPatterns(report.viral_patterns, report.overview?.videos_analysed ?? 0),
    sectionWhy(report.why_content_works),
    sectionInsights('14. Content Gaps 内容缺口', report.content_gaps, 'audience_insights 中没有 status=active 的 content_gap。'),
    sectionOpportunities(report.opportunities),
    sectionSources(report.source_videos),
  ];
  return `${sections.join('\n\n')}\n`;
}

function sectionOverview(overview: ReportOverview | undefined): string {
  const lines = ['1. Research Overview 研究概览'];
  if (!overview) {
    lines.push(empty('报告 JSON 缺少 overview。'));
    return lines.join('\n');
  }
  lines.push(`Project 项目: ${show(overview.project)}`);
  lines.push(`Research Topic 研究主题: ${show(overview.topic)}`);
  lines.push(`Target Market 目标市场: ${show(overview.target_market)}`);
  lines.push(`Date 日期: ${show(overview.date)}`);
  lines.push(`Platforms 平台: ${overview.platforms?.length ? overview.platforms.join(', ') : '（未提供）'}`);
  lines.push(`Videos Collected 采集视频: ${fmtCount(overview.videos_collected)}`);
  lines.push(`Videos Deeply Analysed 深度分析: ${fmtCount(overview.videos_analysed)}`);
  lines.push(`High Potential Videos 高潜视频: ${fmtCount(overview.high_potential)}`);
  lines.push(commentCollectionLine(overview));
  lines.push(`证据来源: ${overview.comments_collected
    ? '已采集评论正文，证据同时来自评论、字幕/文案/转写与视频分析。'
    : COMMENTS_MISSING}`);
  return lines.join('\n');
}

function sectionAudience(audience: ReportAudienceNarrative | undefined): string {
  const lines = ['3. Target Audience 目标受众'];
  const segments = audience?.segments ?? [];
  const narrative = [
    textOrNull(audience?.primary),
    textOrNull(audience?.secondary),
    textOrNull(audience?.state),
    textOrNull(audience?.why_watch),
  ].filter(Boolean);
  if (!narrative.length && segments.length === 0) {
    lines.push(empty('没有受众叙述，audience_insights 中也没有 status=active 的 audience_segment。'));
    return lines.join('\n');
  }
  lines.push(`Primary 主要人群: ${show(audience?.primary)}`);
  lines.push(`Secondary 次级人群: ${show(audience?.secondary)}`);
  lines.push(`State 所处状态: ${show(audience?.state)}`);
  lines.push(`Why Watch 为何观看: ${show(audience?.why_watch)}`);
  if (!narrative.length) {
    lines.push('受众叙述未生成（模型未返回，或报告 status 为 partial）。下面是数据库中的受众分段。');
  }
  if (segments.length === 0) {
    lines.push('Audience Segments 受众分段:');
    lines.push(empty('audience_insights 中没有 status=active 的 audience_segment。'));
  } else {
    lines.push('Audience Segments 受众分段:');
    lines.push(segments.map(formatInsight).join('\n\n'));
  }
  return lines.join('\n');
}

function sectionNeeds(needs: ReportInsight[] | undefined): string {
  const lines = ['6. Needs 需求'];
  const items = needs ?? [];
  if (items.length === 0) {
    lines.push(empty('audience_insights 中没有 status=active 的 need（含 functional 与 emotional）。'));
    return lines.join('\n');
  }
  const functional = items.filter((item) => normalizeKind(item.need_kind) === 'functional');
  const emotional = items.filter((item) => normalizeKind(item.need_kind) === 'emotional');
  const other = items.filter((item) => {
    const kind = normalizeKind(item.need_kind);
    return kind !== 'functional' && kind !== 'emotional';
  });
  lines.push(needGroup('Functional 功能需求', functional, '没有 need_kind=functional 的需求。'));
  lines.push(needGroup('Emotional 心理需求', emotional, '没有 need_kind=emotional 的需求。'));
  if (other.length) lines.push(needGroup('Other 未分类需求', other, ''));
  return lines.join('\n');
}

function needGroup(title: string, items: ReportInsight[], emptyReason: string): string {
  if (items.length === 0) return `${title}\n${empty(emptyReason)}`;
  return `${title}\n${items.map(formatInsight).join('\n\n')}`;
}

function sectionInsights(heading: string, items: ReportInsight[] | undefined, reason: string): string {
  const list = items ?? [];
  if (list.length === 0) return section(heading, empty(reason));
  return section(heading, list.map(formatInsight).join('\n\n'));
}

function formatInsight(item: ReportInsight): string {
  const urls = (item.evidence_video_urls ?? []).filter(Boolean);
  const quotes = item.supporting_quotes ?? [];
  const lines = [
    `Name 名称: ${show(item.title)}`,
    `Surface Problem 表面问题: ${show(item.surface_problem)}`,
    `Underlying Problem 底层问题: ${show(item.underlying_problem)}`,
    `Underlying Need 底层需求: ${show(item.underlying_need)}`,
    `Desired Outcome 期望结果: ${show(item.desired_outcome)}`,
    item.need_kind ? `Need Kind 需求类型: ${item.need_kind}` : null,
    `Evidence 证据: ${fmtCount(item.evidence_count)} videos (${fmtCount(item.high_potential_count)} high potential)`,
    'Video URLs 视频链接:',
    urls.length ? urls.map((url) => `- ${url}`).join('\n') : '- （无视频 URL）',
    `Frequency 频率: ${fmtPct(item.frequency_pct)}`,
    `Confidence 置信度: ${show(item.confidence)}`,
    `Observation level 观察层级: ${show(item.observation_level)}`,
    'Quotes 引用:',
    quotes.length
      ? quotes.map((quote) => `- "${quote.quote}"${quote.source ? ` [${quote.source}]` : ''}${quote.url ? ` — ${quote.url}` : ''}`).join('\n')
      : '- （无引用）',
    `Description 说明: ${show(item.description)}`,
  ];
  return lines.filter((line) => line != null).join('\n');
}

function sectionPatterns(patterns: ReportViralPatterns | undefined, analysed: number): string {
  const lines = ['12. Viral Content Patterns 爆款内容模式'];
  const hooks = patterns?.top_hooks ?? [];
  const hasStats = PATTERN_BLOCKS.some((block) => ((patterns?.[block.key] as ReportPatternStat[] | undefined) ?? []).length > 0);
  if (!patterns || (!hasStats && hooks.length === 0)) {
    lines.push(empty('本次运行没有 status=complete 且 is_latest 的视频分析，无法统计爆款模式。'));
    return lines.join('\n');
  }
  lines.push(`占比分母：已深度分析视频 ${fmtCount(analysed)}。百分比 = 该 key 的次数 / 已深度分析视频数。只统计该维度非空的分析。`);
  for (const block of PATTERN_BLOCKS) {
    const stats = (patterns[block.key] as ReportPatternStat[] | undefined) ?? [];
    lines.push('');
    lines.push(block.title);
    if (stats.length === 0) {
      lines.push(empty(block.empty));
      continue;
    }
    for (const stat of stats) {
      lines.push(`- ${stat.label} (${stat.key}): ${fmtCount(stat.count)} (${fmtPct(stat.pct)})`);
    }
  }
  lines.push('');
  lines.push('Top Hooks 高分钩子');
  if (hooks.length === 0) {
    lines.push(empty('已完成分析中没有 hook 文本，或无法按 viral score 排序。'));
  } else {
    hooks.forEach((hook, index) => {
      lines.push(`${index + 1}. Viral Score ${fmtScore(hook.viral_score)} | ${hook.url || '（无视频 URL）'}`);
      lines.push(`   ${hook.hook}`);
    });
  }
  return lines.join('\n');
}

function sectionWhy(items: ReportWhy[] | undefined): string {
  const list = items ?? [];
  if (list.length === 0) {
    return section('13. Why Content Works 内容为何有效', empty('没有同时具备已完成分析、且填写了 why_it_works 或 reusable_pattern 的视频。'));
  }
  const body = list.map((item, index) => [
    `[${index + 1}] Viral Score 爆款分: ${fmtScore(item.viral_score)}`,
    `URL: ${item.url || '（无视频 URL）'}`,
    `Author 作者: ${show(item.author)}`,
    `Why it works 为何有效: ${show(item.why_it_works)}`,
    `Reusable pattern 可复用模式: ${show(item.reusable_pattern)}`,
  ].join('\n')).join('\n\n');
  return section('13. Why Content Works 内容为何有效', body);
}

function sectionOpportunities(items: ReportOpportunity[] | undefined): string {
  const list = items ?? [];
  if (list.length === 0) {
    return section(
      '15. Content Opportunities 内容机会',
      empty('该赛道没有 status=active 的机会；或证据视频与本次运行无交集，且赛道下没有其他 active 机会。'),
    );
  }
  const body = list.map((item, index) => {
    const evidence = item.evidence;
    const urls = (item.related_video_urls ?? []).filter(Boolean);
    const structure = item.content_structure_label
      ? `${item.content_structure_label}${item.content_structure ? ` (${item.content_structure})` : ''}`
      : show(item.content_structure);
    const evidenceLine = evidence
      ? `matching_videos=${fmtCount(evidence.matching_videos)}, high_potential=${fmtCount(evidence.high_potential)}, avg_viral_score=${fmtScore(evidence.avg_viral_score)}, outlier_3x=${fmtCount(evidence.outlier_3x)}, outlier_8x=${fmtCount(evidence.outlier_8x)}`
      : '（未提供）';
    return [
      `[${index + 1}] ${show(item.title)}`,
      `Target Audience 目标受众: ${show(item.target_audience)}`,
      `Pain Point/Need 痛点/需求: ${show(item.pain_point)}`,
      `Topic 话题: ${show(item.topic)}`,
      `Hook 钩子: ${show(item.recommended_hook)}`,
      `Angle 角度: ${show(item.angle)}`,
      `Recommended Structure 推荐结构: ${structure}`,
      `Why It May Work 为何可能有效: ${show(item.why_now)}`,
      `Evidence 证据: ${evidenceLine}`,
      'Related video URLs 相关视频:',
      urls.length ? urls.map((url) => `- ${url}`).join('\n') : '- （无视频 URL）',
      `Opportunity type 机会类型: ${show(item.opportunity_type_label || item.opportunity_type)}`,
      `Platform 平台建议: ${show(item.platform_suggestion)}`,
    ].join('\n');
  }).join('\n\n');
  return section('15. Content Opportunities 内容机会', body);
}

function sectionSources(items: ReportSourceVideo[] | undefined): string {
  const list = items ?? [];
  if (list.length === 0) {
    return section('16. Source Videos 来源视频', empty('本次 research run 没有关联视频（research_run_videos 为空）。'));
  }
  const body = list.map((item, index) => [
    `[${index + 1}]`,
    `URL: ${item.url || '（无视频 URL）'}`,
    `Author 作者: ${show(item.author)}`,
    `Views 播放: ${fmtCount(item.views)}`,
    `Likes 点赞: ${fmtCount(item.likes)}`,
    `Comments 评论: ${fmtCount(item.comments)}`,
    formatTopComments(item.top_comments),
    `Shares 分享: ${fmtCount(item.shares)}`,
    `Saves 收藏: ${fmtCount(item.saves)}`,
    `Viral Score 爆款分: ${fmtScore(item.viral_score)}`,
    `AI Summary 分析摘要: ${show(item.summary)}`,
  ].join('\n')).join('\n\n');
  return section('16. Source Videos 来源视频', body);
}

function commentCollectionLine(overview: ReportOverview): string {
  const count = Math.max(0, Math.round(overview.comment_count ?? 0));
  const videos = Math.max(0, Math.round(overview.comment_video_count ?? 0));
  if (count <= 0) return '评论采集: 未采集';
  return `评论采集: ${count} 条评论（来自 ${videos} 个视频）`;
}

function formatTopComments(comments: ReportCommentSnippet[] | undefined): string {
  const list = (comments ?? []).filter((item) => item.text.trim()).slice(0, 3);
  if (list.length === 0) return '高赞评论: （无）';
  const lines = list.map((item) => {
    const likes = item.likes == null ? '' : `（赞 ${Math.round(item.likes)}）`;
    return `- ${item.text}${likes}`;
  });
  return ['高赞评论:', ...lines].join('\n');
}

function section(heading: string, body: string): string {
  return `${heading}\n${body}`;
}

function empty(reason: string): string {
  return `${NO_DATA}\n原因: ${reason}`;
}

function show(value: string | null | undefined): string {
  const text = textOrNull(value);
  return text ?? '（未提供）';
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeKind(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function fmtCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '（未提供）';
  return String(Math.round(value));
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '（未提供）';
  return `${Math.round(value * 10) / 10}%`;
}

function fmtScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '（未提供）';
  return String(Math.round(value * 10) / 10);
}

export function opportunityTypeLabel(key: string | null): string | null {
  if (!key) return null;
  return (OPPORTUNITY_TYPE_LABELS as Record<string, string>)[key] ?? key;
}
