import { snakeLabel, titleCaseLabel } from '@/lib/research/labels';
import { t } from '@/lib/i18n';

export function providerLabel(provider: string | null | undefined): string {
  if (provider === 'apify') return 'Apify TikTok';
  if (provider === 'tikhub') return 'TikHub TikTok';
  if (provider === 'youtube') return t('provider.youtubeFallback');
  if (!provider) return t('provider.pending');
  return provider;
}

/** Null stays an em dash. A real zero stays 0. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const numeric = Number(value);
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) return `${trimNumber(numeric / 1_000_000)}M`;
  if (abs >= 10_000) return `${trimNumber(numeric / 1_000)}K`;
  return numeric.toLocaleString('zh-CN');
}

function trimNumber(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function humanize(label: string | null | undefined): string {
  if (!label) return t('common.untitled');
  const trimmed = label.replace(/\s+/g, ' ').trim();
  if (!trimmed) return t('common.untitled');
  const raw = !trimmed.includes(' ') && (trimmed.includes('_') || trimmed === trimmed.toLowerCase());
  if (!raw) return trimmed; // AI Title Case / free-text labels stay as returned
  const key = snakeLabel(trimmed) || trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const enumKey = `enum.${key}` as const;
  const translated = t(enumKey);
  if (translated !== enumKey) return translated;
  return titleCaseLabel(trimmed.replace(/[_-]+/g, ' '));
}

export function percentPoints(value: number | string | null | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric == null || Number.isNaN(numeric)) return 0;
  const points = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(points)));
}

const STEP_KEYS: Record<string, string> = {
  created: 'step.created',
  keyword_expansion: 'step.keyword_expansion',
  scraping: 'step.scraping',
  normalizing: 'step.normalizing',
  scoring: 'step.scoring',
  analyzing: 'step.analyzing',
  clustering: 'step.clustering',
  generating_insights: 'step.generating_insights',
  completed: 'step.completed',
  failed: 'step.failed',
  cancelled: 'step.cancelled',
  waiting: 'step.waiting',
  pending: 'step.pending',
  running: 'step.running',
};

export function stepLabel(step: string | null | undefined): string {
  if (!step) return t('step.waiting');
  const key = STEP_KEYS[step];
  if (key) return t(key);
  return step.replace(/_/g, ' ');
}
