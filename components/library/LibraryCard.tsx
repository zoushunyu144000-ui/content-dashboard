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
  tiktokPlatformVideoId,
  type LibraryVideo,
} from './shared';

interface LibraryCardProps {
  video: LibraryVideo;
  playing: boolean;
  onPlay: (id: string) => void;
  onStop: () => void;
  onOpen: (id: string) => void;
}

export default function LibraryCard({ video, playing, onPlay, onStop, onOpen }: LibraryCardProps) {
  const [broken, setBroken] = useState(false);
  const showThumb = Boolean(video.thumbnail_url) && !broken;
  const tiktokId = tiktokPlatformVideoId(video);
  const inline = playing && Boolean(tiktokId);

  return (
    <article className="panel flex h-full w-full flex-col overflow-hidden p-0 text-cream">
      <div className="relative aspect-[9/16] w-full bg-black">
        {inline && tiktokId ? (
          <>
            <iframe
              src={`https://www.tiktok.com/player/v1/${tiktokId}?autoplay=1&controls=1&description=0&music_info=0&rel=0`}
              title={video.caption?.trim() || t('common.video')}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
            <button
              type="button"
              onClick={onStop}
              className="absolute left-2 top-2 z-10 cursor-pointer rounded-full bg-black/70 px-2 py-1 text-[11px] text-white hover:bg-black"
            >
              ✕ {t('library.stopPlayback')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { if (tiktokId) onPlay(video.id); }}
            className="absolute inset-0 block h-full w-full cursor-pointer"
            aria-label={t('library.playVideo')}
          >
            {showThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnail_url || undefined}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setBroken(true)}
              />
            ) : (
              <span className="flex h-full items-center justify-center text-xs text-muted">
                {t('feed.noPreview')}
              </span>
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-lg text-white">▶</span>
            </span>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpen(video.id)}
        className="flex flex-1 cursor-pointer flex-col gap-2 p-3 text-left font-[inherit] text-cream transition hover:bg-card-hover"
      >
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
        <span className="text-xs text-accent">{t('library.analysisCta')}</span>
      </button>
    </article>
  );
}
