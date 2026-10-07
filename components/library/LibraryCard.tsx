'use client';

import { useState } from 'react';
import MetricPill from '@/components/MetricPill';
import ScoreBadge from '@/components/ScoreBadge';
import { t } from '@/lib/i18n';
import {
  HOOK_LABELS,
  authorLabel,
  isAnalyzed,
  labelOf,
  platformLabel,
  type LibraryVideo,
} from './shared';

interface LibraryCardProps {
  video: LibraryVideo;
  onOpen: (id: string) => void;
}

export default function LibraryCard({ video, onOpen }: LibraryCardProps) {
  const [broken, setBroken] = useState(false);
  const showThumb = Boolean(video.thumbnail_url) && !broken;

  return (
    <button
      type="button"
      onClick={() => onOpen(video.id)}
      className="panel flex h-full w-full flex-col overflow-hidden p-0 text-left font-[inherit] text-cream transition hover:bg-card-hover"
    >
      {showThumb ? (
        <img
          src={video.thumbnail_url || undefined}
          alt={video.caption?.trim() || t('common.video')}
          className="aspect-[4/5] w-full bg-black object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center bg-black text-xs text-muted">
          {t('feed.noPreview')}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm">{video.caption?.trim() || '—'}</p>
        <p className="truncate text-xs text-muted">
          {authorLabel(video.author_handle)}
          <span className="px-1">·</span>
          {platformLabel(video.platform)}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <MetricPill label={t('feed.views')} value={video.views} />
          <MetricPill label={t('feed.likes')} value={video.likes} />
          <MetricPill label={t('feed.comments')} value={video.comments} />
          <MetricPill label={t('feed.shares')} value={video.shares} />
          <MetricPill label={t('feed.saves')} value={video.saves} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted">{t('score.viral')}</span>
          <ScoreBadge score={video.viral_score} high={Boolean(video.is_high_potential)} />
          {video.hook_type ? <span className="status-badge">{labelOf(HOOK_LABELS, video.hook_type)}</span> : null}
          {!isAnalyzed(video) ? <span className="status-badge">未分析</span> : null}
        </div>
        <p className="truncate text-xs"><span className="text-muted">话题 </span>{video.topic?.trim() || '—'}</p>
        <p className="truncate text-xs"><span className="text-muted">痛点 </span>{video.pain_point?.trim() || '—'}</p>
      </div>
    </button>
  );
}
