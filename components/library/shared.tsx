import { t } from '@/lib/i18n';
import {
  AUDIENCE_CATEGORY_LABELS,
  CONTENT_FORMAT_LABELS,
  CONTENT_STRUCTURE_LABELS,
  CTA_TYPE_LABELS,
  EMOTION_LABELS,
  HOOK_TYPE_LABELS,
  PAIN_POINT_CATEGORY_LABELS,
  TOPIC_CATEGORY_LABELS,
  VALUE_LEVELS,
  VALUE_LEVEL_LABELS,
  VALUE_TYPE_LABELS,
  VALUE_TYPES,
  type ValueLevel,
  type ValueType,
} from '@/lib/research/taxonomy';

export interface LibraryVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  author_handle: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  published_at: string | null;
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
  summary: string | null;
  prompt_version: string | null;
}

export interface FacetBucket {
  key: string;
  count: number;
}

export interface LibraryFacets {
  hook_type: FacetBucket[];
  pain_point_category: FacetBucket[];
  topic_category: FacetBucket[];
  emotion: FacetBucket[];
  content_structure: FacetBucket[];
  audience_category: FacetBucket[];
  content_format: FacetBucket[];
  cta_type: FacetBucket[];
}

export const EMPTY_FACETS: LibraryFacets = {
  hook_type: [],
  pain_point_category: [],
  topic_category: [],
  emotion: [],
  content_structure: [],
  audience_category: [],
  content_format: [],
  cta_type: [],
};

export const LIBRARY_FILTER_PARAMS = [
  'pain_point_category',
  'topic_category',
  'hook_type',
  'emotion',
  'content_structure',
  'audience_category',
  'content_format',
  'cta_type',
  'analyzed',
  'high_potential',
] as const;

export type LibraryFilterParam = (typeof LIBRARY_FILTER_PARAMS)[number];

export interface LibraryFilterDef {
  param: Exclude<LibraryFilterParam, 'analyzed' | 'high_potential'>;
  label: string;
  labels: Record<string, string>;
  facet: keyof LibraryFacets;
}

function asLabels(map: object): Record<string, string> {
  return map as Record<string, string>;
}

export const LIBRARY_FILTERS: LibraryFilterDef[] = [
  { param: 'pain_point_category', label: '痛点', labels: asLabels(PAIN_POINT_CATEGORY_LABELS), facet: 'pain_point_category' },
  { param: 'topic_category', label: '话题', labels: asLabels(TOPIC_CATEGORY_LABELS), facet: 'topic_category' },
  { param: 'hook_type', label: 'Hook 类型', labels: asLabels(HOOK_TYPE_LABELS), facet: 'hook_type' },
  { param: 'emotion', label: '情绪', labels: asLabels(EMOTION_LABELS), facet: 'emotion' },
  { param: 'content_structure', label: '内容结构', labels: asLabels(CONTENT_STRUCTURE_LABELS), facet: 'content_structure' },
  { param: 'audience_category', label: '受众', labels: asLabels(AUDIENCE_CATEGORY_LABELS), facet: 'audience_category' },
  { param: 'content_format', label: '内容形式', labels: asLabels(CONTENT_FORMAT_LABELS), facet: 'content_format' },
  { param: 'cta_type', label: 'CTA', labels: asLabels(CTA_TYPE_LABELS), facet: 'cta_type' },
];

export const HOOK_LABELS = asLabels(HOOK_TYPE_LABELS);
export const EMOTION_LABEL_MAP = asLabels(EMOTION_LABELS);
export const STRUCTURE_LABELS = asLabels(CONTENT_STRUCTURE_LABELS);
export const FORMAT_LABELS = asLabels(CONTENT_FORMAT_LABELS);
export const CTA_LABELS = asLabels(CTA_TYPE_LABELS);
export const AUDIENCE_LABELS = asLabels(AUDIENCE_CATEGORY_LABELS);
export const PAIN_LABELS = asLabels(PAIN_POINT_CATEGORY_LABELS);
export const TOPIC_LABELS = asLabels(TOPIC_CATEGORY_LABELS);

const ANALYSIS_FIELDS = [
  'audience',
  'audience_category',
  'pain_point',
  'pain_point_category',
  'topic',
  'topic_category',
  'hook',
  'hook_type',
  'emotion',
  'content_structure',
  'content_format',
  'cta_type',
  'why_it_works',
  'what_not_to_copy',
  'replicability_score',
  'value_types',
  'tags',
  'viral_hypothesis',
  'reusable_pattern',
  'summary',
  'prompt_version',
] as const satisfies readonly (keyof LibraryVideo)[];

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  if (map[key]) return map[key];
  const translated = t(`enum.${key}`);
  return translated === `enum.${key}` ? key : translated;
}

export function textOrDash(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const text = String(value).trim();
  return text || '—';
}

export function isAnalyzed(video: LibraryVideo): boolean {
  return video.analysis_status === 'complete';
}

export function authorLabel(handle: string | null | undefined): string {
  const trimmed = handle?.trim() || '';
  if (!trimmed) return t('feed.unknownAuthor');
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return '—';
  if (platform === 'tiktok') return 'TikTok';
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'instagram') return 'Instagram';
  return platform;
}

export function tiktokPlatformVideoId(video: {
  platform?: string | null;
  platform_video_id?: string | null;
  url?: string | null;
}): string | null {
  if (video.platform !== 'tiktok') return null;
  const direct = video.platform_video_id?.trim();
  if (direct) return direct;
  const match = video.url?.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

export function tiktokPlayerSrc(id: string): string {
  return `https://www.tiktok.com/player/v1/${id}?autoplay=0&controls=1&description=0&music_info=0&rel=0`;
}

export function scoreText(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(Math.round(Number(value)));
}

export function readFilterQuery(search: { get: (key: string) => string | null }): string {
  const params = new URLSearchParams();
  for (const key of LIBRARY_FILTER_PARAMS) {
    const value = search.get(key);
    if (!value) continue;
    if (key === 'analyzed' && value !== 'yes' && value !== 'no') continue;
    if (key === 'high_potential' && value !== '1') continue;
    params.set(key, value);
  }
  return params.toString();
}

export function filterValues(filterQuery: string): Record<LibraryFilterParam, string> {
  const params = new URLSearchParams(filterQuery);
  const out = {} as Record<LibraryFilterParam, string>;
  for (const key of LIBRARY_FILTER_PARAMS) out[key] = params.get(key) || '';
  return out;
}

export function buildLibraryUrl(nicheId: string, filterQuery: string): string {
  const next = new URLSearchParams();
  next.set('niche', nicheId);
  next.set('limit', '100');
  const filters = new URLSearchParams(filterQuery);
  filters.forEach((value, key) => {
    if (value) next.set(key, value);
  });
  return `/api/library?${next.toString()}`;
}

export function normalizeFacets(value: Partial<LibraryFacets> | null | undefined): LibraryFacets {
  const source = value || {};
  const read = (key: keyof LibraryFacets): FacetBucket[] => {
    const raw = source[key];
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const bucket = item as { key?: unknown; count?: unknown };
      if (typeof bucket.key !== 'string' || !bucket.key) return [];
      return [{ key: bucket.key, count: Number(bucket.count) || 0 }];
    });
  };
  return {
    hook_type: read('hook_type'),
    pain_point_category: read('pain_point_category'),
    topic_category: read('topic_category'),
    emotion: read('emotion'),
    content_structure: read('content_structure'),
    audience_category: read('audience_category'),
    content_format: read('content_format'),
    cta_type: read('cta_type'),
  };
}

export function facetOptions(
  labels: Record<string, string>,
  buckets: FacetBucket[],
  selected: string,
): Array<{ key: string; count: number | null }> {
  const counts = new Map(buckets.map((bucket) => [bucket.key, bucket.count]));
  const keys = buckets.length > 0 ? buckets.map((bucket) => bucket.key) : Object.keys(labels);
  if (selected && !keys.includes(selected)) keys.unshift(selected);
  return keys.map((key) => ({
    key,
    count: counts.has(key) ? counts.get(key) ?? 0 : buckets.length > 0 ? 0 : null,
  }));
}

export function readTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return readTags(parsed);
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function readValueLevels(value: unknown): Record<ValueType, ValueLevel> {
  let source: unknown = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }
  const record = source && typeof source === 'object' && !Array.isArray(source)
    ? source as Record<string, unknown>
    : {};
  const out = {} as Record<ValueType, ValueLevel>;
  for (const key of VALUE_TYPES) {
    const raw = record[key];
    out[key] = typeof raw === 'string' && (VALUE_LEVELS as readonly string[]).includes(raw)
      ? raw as ValueLevel
      : 'none';
  }
  return out;
}

export function valueTypeLabel(key: ValueType): string {
  return VALUE_TYPE_LABELS[key];
}

export function valueLevelLabel(level: ValueLevel): string {
  return VALUE_LEVEL_LABELS[level];
}

export function detailText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function mergeAnalysis(video: LibraryVideo, body: unknown): LibraryVideo {
  const next: LibraryVideo = { ...video, analysis_status: 'complete', analysis_error: null };
  const source = analysisSource(body);
  if (!source) return next;
  const patch: Partial<LibraryVideo> = {};
  for (const key of ANALYSIS_FIELDS) {
    if (source[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = source[key];
    }
  }
  const merged: LibraryVideo = { ...next, ...patch };
  if (typeof source.analysis_status === 'string') merged.analysis_status = source.analysis_status;
  else if (typeof source.status === 'string') merged.analysis_status = source.status;
  if ('analysis_error' in source) {
    merged.analysis_error = typeof source.analysis_error === 'string' ? source.analysis_error : null;
  } else if ('error' in source) {
    merged.analysis_error = typeof source.error === 'string' ? source.error : null;
  }
  return merged;
}

function analysisSource(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.analysis && typeof record.analysis === 'object' && !Array.isArray(record.analysis)) {
    return record.analysis as Record<string, unknown>;
  }
  if (record.video && typeof record.video === 'object' && !Array.isArray(record.video)) {
    return record.video as Record<string, unknown>;
  }
  return record;
}

export { VALUE_TYPES };
export type { ValueLevel, ValueType };
