import { t } from '@/lib/i18n';
import {
  HOOK_LABELS,
  PAIN_LABELS,
  STRUCTURE_LABELS,
  TOPIC_LABELS,
  labelOf,
  textOrDash,
} from '@/components/library/shared';
import { OPPORTUNITY_TYPE_LABELS } from '@/lib/research/taxonomy';

export interface OpportunityEvidence {
  matching_videos?: number | string | null;
  high_potential?: number | string | null;
  avg_viral_score?: number | string | null;
  outlier_3x?: number | string | null;
  outlier_8x?: number | string | null;
  total_views?: number | string | null;
  criteria?: {
    pain_point_category?: string | null;
    topic_category?: string | null;
    hook_type?: string | null;
  } | null;
}

export interface Opportunity {
  id: string;
  title: string;
  topic?: string | null;
  target_audience?: string | null;
  pain_point?: string | null;
  recommended_hook?: string | null;
  angle?: string | null;
  content_structure?: string | null;
  why_now?: string | null;
  opportunity_type?: string | null;
  platform_suggestion?: string | null;
  evidence?: OpportunityEvidence | null;
  evidence_video_ids?: string[];
  created_at?: string | null;
}

export interface EvidenceVideo {
  id: string;
  caption?: string | null;
  author_handle?: string | null;
  thumbnail_url?: string | null;
  url?: string | null;
  views?: number | string | null;
  viral_score?: number | string | null;
  pain_point?: string | null;
  hook_type?: string | null;
}

export interface RankItem {
  key: string;
  count?: number | string | null;
  pct?: number | string | null;
  avg_viral_score?: number | string | null;
}

export interface ViralVideo {
  id: string;
  caption?: string | null;
  thumbnail_url?: string | null;
  author_handle?: string | null;
  views?: number | string | null;
  viral_score?: number | string | null;
  hook_type?: string | null;
}

export interface DashboardPayload {
  niche?: { id?: string; name?: string | null } | null;
  week?: {
    videos_discovered?: number | string | null;
    high_potential?: number | string | null;
    opportunities?: number | string | null;
  } | null;
  totals?: { videos?: number | string | null; analyzed?: number | string | null } | null;
  trending_pain_point?: RankItem | null;
  best_hook?: RankItem | null;
  emerging_topic?: RankItem | null;
  recommended?: Opportunity | null;
  top_pain_points?: RankItem[] | null;
  top_hooks?: RankItem[] | null;
  top_topics?: RankItem[] | null;
  recent_viral?: ViralVideo[] | null;
}

const TYPE_LABELS = OPPORTUNITY_TYPE_LABELS as Record<string, string>;

export function opportunityTypeLabel(type: string | null | undefined): string {
  return labelOf(TYPE_LABELS, type);
}

export function structureLabel(value: string | null | undefined): string {
  return labelOf(STRUCTURE_LABELS, value);
}

export function painLabel(value: string | null | undefined): string {
  return labelOf(PAIN_LABELS, value);
}

export function hookLabel(value: string | null | undefined): string {
  return labelOf(HOOK_LABELS, value);
}

export function topicLabel(value: string | null | undefined): string {
  return labelOf(TOPIC_LABELS, value);
}

export function formatScore(value: unknown): string {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const rounded = Math.round(numeric * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatInt(value: unknown): string {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return Math.round(numeric).toLocaleString('zh-CN');
}

function countText(value: unknown): string {
  if (value == null || value === '') return '0';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return String(Math.round(numeric));
}

export function evidenceLine(evidence: OpportunityEvidence | null | undefined): string {
  return t('opportunities.evidenceLine', {
    matching_videos: countText(evidence?.matching_videos),
    high_potential: countText(evidence?.high_potential),
    avg: formatScore(evidence?.avg_viral_score),
    outlier_3x: countText(evidence?.outlier_3x),
    outlier_8x: countText(evidence?.outlier_8x),
  });
}

export function buildBrief(opportunity: Opportunity): string {
  return [
    `${t('opportunities.field.title')}：${textOrDash(opportunity.title)}`,
    `${t('opportunities.field.audience')}：${textOrDash(opportunity.target_audience)}`,
    `${t('opportunities.field.pain')}：${textOrDash(opportunity.pain_point)}`,
    `${t('opportunities.field.hook')}：${textOrDash(opportunity.recommended_hook)}`,
    `${t('opportunities.field.angle')}：${textOrDash(opportunity.angle)}`,
    `${t('opportunities.field.structure')}：${structureLabel(opportunity.content_structure)}`,
    `${t('opportunities.field.cta')}：${t('opportunities.ctaSuggestion')}`,
    `${t('opportunities.field.platform')}：${textOrDash(opportunity.platform_suggestion)}`,
    `${t('opportunities.field.evidence')}：${evidenceLine(opportunity.evidence)}`,
  ].join('\n');
}

export function libraryHref(
  projectId: string | undefined,
  filters: Record<string, string | null | undefined>,
  videoId?: string,
): string {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  if (videoId) params.set('video', videoId);
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/library?${query}` : '/library';
}

export function opportunityHref(projectId: string | undefined, id: string, hash?: string): string {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  const query = params.toString();
  return `/opportunities/${encodeURIComponent(id)}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

export function opportunitiesHomeHref(projectId: string | undefined): string {
  return projectId ? `/opportunities?project=${encodeURIComponent(projectId)}` : '/opportunities';
}

export function criteriaHref(projectId: string | undefined, evidence: OpportunityEvidence | null | undefined): string {
  const criteria = evidence?.criteria;
  return libraryHref(projectId, {
    pain_point_category: criteria?.pain_point_category,
    topic_category: criteria?.topic_category,
    hook_type: criteria?.hook_type,
  });
}
