import { canonicalLabel, titleCaseLabel } from '@/lib/research/labels';

export function providerLabel(provider: string | null | undefined): string {
  if (provider === 'apify') return 'Apify TikTok';
  if (provider === 'tikhub') return 'TikHub TikTok';
  if (provider === 'youtube') return 'YouTube Shorts (yt-dlp fallback)';
  if (!provider) return 'Pending';
  return provider;
}

/** Null stays an em dash. A real zero stays 0. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const numeric = Number(value);
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) return `${trimNumber(numeric / 1_000_000)}M`;
  if (abs >= 10_000) return `${trimNumber(numeric / 1_000)}K`;
  return numeric.toLocaleString();
}

function trimNumber(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function humanize(label: string | null | undefined): string {
  if (!label) return 'Untitled';
  const trimmed = label.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'Untitled';
  const raw = !trimmed.includes(' ') && (trimmed.includes('_') || trimmed === trimmed.toLowerCase());
  if (!raw) return trimmed;
  const key = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return canonicalLabel(key) || titleCaseLabel(trimmed.replace(/[_-]+/g, ' '));
}

export function percentPoints(value: number | string | null | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric == null || Number.isNaN(numeric)) return 0;
  const points = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(points)));
}

export function stepLabel(step: string | null | undefined): string {
  if (!step) return 'Waiting';
  return step.replace(/_/g, ' ');
}
