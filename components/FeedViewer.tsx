'use client';

import { useEffect, useRef, useState } from 'react';
import MetricPill from './MetricPill';
import ScoreBadge from './ScoreBadge';
import { formatCount, humanize, providerLabel } from '@/lib/client/format';
import { isOffTopic } from '@/lib/research/relevance';
import { t } from '@/lib/i18n';

export interface FeedVideo {
  id: string;
  platform: string | null;
  platform_video_id: string | null;
  url: string | null;
  video_url: string | null;
  video_url_expires_at: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  author_handle: string | null;
  author_name: string | null;
  author_followers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  viral_score: number | null;
  is_high_potential: boolean | null;
  hook: string | null;
  pain_point: string | null;
  content_structure: string | null;
  viral_hypothesis: string | null;
  audience: string | null;
  emotion: string | null;
  topic: string | null;
  reusable_pattern: string | null;
  replicability: number | null;
  relevance?: number | null;
  relevance_reason?: string | null;
}

interface FeedViewerProps {
  videos: FeedVideo[];
  provider: string | null;
  initialVideoId?: string;
}

function tiktokPlatformVideoId(video: FeedVideo): string | null {
  if (video.platform === 'youtube') return null;
  const fromUrl = video.url?.match(/\/video\/(\d+)/)?.[1]
    || video.embed_url?.match(/\/(?:video|player\/v1|embed\/v2)\/(\d+)/)?.[1]
    || '';
  if (video.platform === 'tiktok' || video.platform == null) {
    return video.platform_video_id?.trim() || fromUrl || null;
  }
  if (/tiktok\.com/i.test(video.url || '') || /tiktok\.com/i.test(video.embed_url || '')) {
    return fromUrl || null;
  }
  return null;
}

function tiktokPlayerSrc(id: string): string {
  return `https://www.tiktok.com/player/v1/${id}?autoplay=0&controls=1&description=0&music_info=0&rel=0`;
}

function embedSrc(video: FeedVideo): string | null {
  const id = video.platform_video_id?.trim() || '';
  if (video.platform === 'youtube' && id) {
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0`;
  }
  const tiktokId = tiktokPlatformVideoId(video);
  if (tiktokId) return tiktokPlayerSrc(tiktokId);
  if (video.embed_url && /tiktok\.com/i.test(video.embed_url)) return null;
  return video.embed_url;
}

function videoIsPlayable(video: FeedVideo): boolean {
  if (!video.video_url || !video.video_url_expires_at) return false;
  const expires = Date.parse(video.video_url_expires_at);
  return Number.isFinite(expires) && expires > Date.now();
}

function textOrDash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function SlideMedia({ video, mountEmbed, active }: { video: FeedVideo; mountEmbed: boolean; active: boolean }) {
  const playable = videoIsPlayable(video);
  const embed = embedSrc(video);
  const ref = useRef<HTMLVideoElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (active && playable) node.play().catch(() => {});
    else node.pause();
  }, [active, playable]);

  if (playable) {
    return (
      <video
        ref={ref}
        src={video.video_url || undefined}
        poster={video.thumbnail_url || undefined}
        playsInline
        muted
        loop
        controls
        className="h-full w-full bg-black object-contain"
      />
    );
  }

  if (mountEmbed && embed && !broken) {
    return (
      <iframe
        src={embed}
        title={video.caption || t('feed.embeddedVideo')}
        className="h-full w-full border-0 bg-black"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {video.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">{t('feed.noPreview')}</div>
      )}
      {embed ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg text-white" aria-hidden="true">▶</span>
      ) : video.url ? (
        <a className="btn-primary absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" href={video.url} target="_blank" rel="noreferrer">
          {t('feed.openOriginal')}
        </a>
      ) : null}
    </div>
  );
}

function AnalysisDetails({ video }: { video: FeedVideo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4 break-words">
      {video.caption ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{video.caption}</p> : null}
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('feed.field.hook')}</dt>
          <dd>{textOrDash(video.hook)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('feed.field.painPoint')}</dt>
          <dd>{video.pain_point ? humanize(video.pain_point) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('feed.field.contentStructure')}</dt>
          <dd>{video.content_structure ? humanize(video.content_structure) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('feed.field.viralHypothesis')}</dt>
          <dd>{textOrDash(video.viral_hypothesis)}</dd>
        </div>
      </dl>
      <button type="button" className="btn-ghost" onClick={() => setOpen((value) => !value)}>
        {open ? t('feed.hideDetail') : t('feed.moreAnalysis')}
      </button>
      {open ? (
        <dl className="space-y-2 text-sm">
          <div><dt className="text-muted">{t('feed.field.audience')}</dt><dd>{textOrDash(video.audience)}</dd></div>
          <div><dt className="text-muted">{t('feed.field.emotion')}</dt><dd>{video.emotion ? humanize(video.emotion) : '—'}</dd></div>
          <div><dt className="text-muted">{t('feed.field.topic')}</dt><dd>{video.topic ? humanize(video.topic) : '—'}</dd></div>
          <div><dt className="text-muted">{t('feed.field.reusablePattern')}</dt><dd>{textOrDash(video.reusable_pattern)}</dd></div>
          <div><dt className="text-muted">{t('feed.field.replicability')}</dt><dd>{textOrDash(video.replicability)}</dd></div>
          <div><dt className="text-muted">{t('feed.field.relevance')}</dt><dd>{textOrDash(video.relevance)}</dd></div>
          <div><dt className="text-muted">{t('feed.field.relevanceReason')}</dt><dd>{textOrDash(video.relevance_reason)}</dd></div>
        </dl>
      ) : null}
      {video.url ? (
        <a className="btn-ghost" href={video.url} target="_blank" rel="noreferrer">{t('feed.openOriginal')}</a>
      ) : (
        <p className="text-xs text-muted">{t('feed.noOriginalUrl')}</p>
      )}
    </div>
  );
}

function Analysis({ video, provider }: { video: FeedVideo; provider: string | null }) {
  const handle = video.author_handle ? `@${video.author_handle}` : (video.author_name || t('feed.unknownAuthor'));
  return (
    <div className="space-y-4 break-words">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{handle}</div>
            {video.author_name && video.author_handle ? (
              <div className="text-xs text-muted">{video.author_name}</div>
            ) : null}
          </div>
          <ScoreBadge score={video.viral_score} high={Boolean(video.is_high_potential)} />
        </div>
        {isOffTopic(video.relevance) ? <div className="mt-2"><span className="off-topic-chip">{t('feed.offTopic')}</span></div> : null}
        <div className="mt-2">
          <MetricPill label={t('feed.followers')} value={video.author_followers} />
        </div>
        <p className="provider-label mt-2">{providerLabel(provider)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricPill label={t('feed.views')} value={video.views} />
        <MetricPill label={t('feed.likes')} value={video.likes} />
        <MetricPill label={t('feed.comments')} value={video.comments} />
        <MetricPill label={t('feed.shares')} value={video.shares} />
        <MetricPill label={t('feed.saves')} value={video.saves} />
      </div>
      <AnalysisDetails video={video} />
    </div>
  );
}

export default function FeedViewer({ videos, provider, initialVideoId = '' }: FeedViewerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !initialVideoId) return;
    const found = videos.findIndex((video) => video.id === initialVideoId);
    if (found < 0) return;
    indexRef.current = found;
    setIndex(found);
    root.scrollTo({ top: found * root.clientHeight });
  }, [initialVideoId, videos]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || visible.intersectionRatio < 0.55) return;
      const next = Number((visible.target as HTMLElement).dataset.feedIndex);
      if (!Number.isFinite(next)) return;
      indexRef.current = next;
      setIndex(next);
    }, { root, threshold: [0.55, 0.8] });
    root.querySelectorAll('[data-feed-index]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [videos]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let lockedUntil = 0;

    function scrollToIndex(next: number) {
      if (!scroller) return;
      const total = videosRef.current.length;
      if (total === 0) return;
      const clamped = Math.max(0, Math.min(total - 1, next));
      indexRef.current = clamped;
      setIndex(clamped);
      scroller.scrollTo({ top: clamped * scroller.clientHeight });
    }

    function onWheel(event: WheelEvent) {
      const panel = (event.target as HTMLElement | null)?.closest('[data-feed-panel]');
      if (panel instanceof HTMLElement) {
        const delta = event.deltaY;
        const canDown = panel.scrollTop + panel.clientHeight < panel.scrollHeight - 2;
        const canUp = panel.scrollTop > 2;
        if ((delta > 0 && canDown) || (delta < 0 && canUp)) return;
      }
      event.preventDefault();
      const now = Date.now();
      if (now < lockedUntil || Math.abs(event.deltaY) < 4) return;
      lockedUntil = now + 480;
      scrollToIndex(indexRef.current + (event.deltaY > 0 ? 1 : -1));
    }

    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'PageDown' && event.key !== 'PageUp') return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' || event.key === 'PageDown' ? 1 : -1;
      scrollToIndex(indexRef.current + direction);
    }

    scroller.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      scroller.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [videos.length]);

  return (
    <div ref={scrollerRef} className="feed-scroller h-full">
      {videos.map((video, videoIndex) => {
        const mountEmbed = Math.abs(videoIndex - index) <= 1;
        return (
          <section key={video.id} data-feed-index={videoIndex} className="feed-slide relative flex flex-col md:block">
            <div className="relative min-h-0 w-full flex-1 md:absolute md:inset-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
              <div className="feed-stage">
                <div className="feed-frame">
                  <SlideMedia video={video} mountEmbed={mountEmbed} active={videoIndex === index} />
                  {video.url ? (
                    <a
                      className="btn-ghost absolute right-3 top-3 z-10 bg-[var(--card)] md:hidden"
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('feed.openOriginal')}
                    </a>
                  ) : null}
                </div>
              </div>
              <aside data-feed-panel className="hidden h-full overflow-y-auto border-l px-4 py-4 md:block" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <p className="mb-3 text-xs text-muted">{videoIndex + 1} / {videos.length}</p>
                <Analysis video={video} provider={provider} />
              </aside>
            </div>
            <MobileChrome video={video} provider={provider} />
          </section>
        );
      })}
    </div>
  );
}

function MobileChrome({ video, provider }: { video: FeedVideo; provider: string | null }) {
  const [open, setOpen] = useState(false);
  const handle = video.author_handle ? `@${video.author_handle}` : (video.author_name || t('feed.unknownAuthor'));
  return (
    <div
      className="shrink-0 border-t md:hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold">
            {handle}
            <span className="font-normal text-muted"> · {formatCount(video.author_followers)}</span>
          </p>
          <ScoreBadge score={video.viral_score} high={Boolean(video.is_high_potential)} />
        </div>
        <p className="text-[12px] leading-5">
          <span className="text-muted">{t('feed.views')} </span>{formatCount(video.views)}
          <span className="text-muted"> · {t('feed.likes')} </span>{formatCount(video.likes)}
          <span className="text-muted"> · {t('feed.comments')} </span>{formatCount(video.comments)}
          <span className="text-muted"> · {t('feed.shares')} </span>{formatCount(video.shares)}
          <span className="text-muted"> · {t('feed.saves')} </span>{formatCount(video.saves)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {video.is_high_potential ? <span className="off-topic-chip" style={{ color: '#dfe3ff', borderColor: 'rgba(139, 147, 255, 0.5)', background: 'rgba(139, 147, 255, 0.16)' }}>{t('feed.highPotential')}</span> : null}
          {isOffTopic(video.relevance) ? <span className="off-topic-chip">{t('feed.offTopic')}</span> : null}
          <span className="provider-label">{providerLabel(provider)}</span>
          <button type="button" className="menu-button ml-auto" onClick={() => setOpen((value) => !value)}>
            {open ? t('feed.hideAnalysis') : t('feed.analysis')}
          </button>
        </div>
      </div>
      {open ? (
        <div data-feed-panel className="max-h-[38vh] overflow-y-auto border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
          <AnalysisDetails video={video} />
        </div>
      ) : null}
    </div>
  );
}
