'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MetricPill from '@/components/MetricPill';
import { useProject } from '@/components/ProjectProvider';
import ScoreBadge from '@/components/ScoreBadge';
import { useToast } from '@/components/ToastProvider';
import { authorLabel, textOrDash } from '@/components/library/shared';
import { ApiError, api } from '@/lib/client/api';
import { formatTime } from '@/lib/client/format';
import { t } from '@/lib/i18n';
import {
  buildBrief,
  criteriaHref,
  evidenceLine,
  formatInt,
  hookLabel,
  opportunitiesHomeHref,
  opportunityTypeLabel,
  structureLabel,
  type EvidenceVideo,
  type Opportunity,
} from './shared';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function VideoRow({ video, projectId }: { video: EvidenceVideo; projectId: string | undefined }) {
  const [broken, setBroken] = useState(false);
  const showThumb = Boolean(video.thumbnail_url) && !broken;
  const views = video.views == null || video.views === '' ? null : Number(video.views);
  const score = video.viral_score == null || video.viral_score === '' ? null : Number(video.viral_score);
  return (
    <li>
      <Link
        href={videoLibraryHref(projectId, video.id)}
        className="panel flex gap-3 p-2 sm:p-3"
      >
        {showThumb ? (
          <img
            src={video.thumbnail_url || undefined}
            alt={video.caption?.trim() || t('common.video')}
            className="h-24 w-16 shrink-0 rounded-md bg-black object-cover sm:h-28 sm:w-20"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md bg-black text-[10px] text-muted sm:h-28 sm:w-20">
            {t('feed.noPreview')}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm">{video.caption?.trim() || '—'}</p>
          <p className="mt-1 truncate text-xs text-muted">{authorLabel(video.author_handle)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <MetricPill label={t('feed.views')} value={Number.isFinite(views) ? views : null} />
            <ScoreBadge score={Number.isFinite(score) ? score : null} />
            {video.hook_type ? <span className="status-badge">{hookLabel(video.hook_type)}</span> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

function videoLibraryHref(projectId: string | undefined, videoId: string): string {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  params.set('video', videoId);
  return `/library?${params.toString()}`;
}

export default function OpportunityDetail() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { showToast } = useToast();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [videos, setVideos] = useState<EvidenceVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setOpportunity(null);
    setVideos([]);
    setLoading(true);
    setError('');
    api<{ opportunity?: Opportunity; videos?: EvidenceVideo[] }>(`/api/opportunities/${encodeURIComponent(id)}`)
      .then((data) => {
        if (cancelled) return;
        setOpportunity(data.opportunity || null);
        setVideos(Array.isArray(data.videos) ? data.videos : []);
        if (!data.opportunity) setError(t('opportunities.notFound'));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError(t('opportunities.notFound'));
          return;
        }
        setError(err instanceof Error ? err.message : t('opportunities.detailLoadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  useEffect(() => {
    if (!opportunity) return;
    if (window.location.hash !== '#brief') return;
    document.getElementById('brief')?.scrollIntoView({ block: 'start' });
  }, [opportunity]);

  const projectId = project?.id;
  const brief = opportunity ? buildBrief(opportunity) : '';
  const typeLabel = opportunity?.opportunity_type ? opportunityTypeLabel(opportunity.opportunity_type) : '';

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(brief);
      showToast(t('opportunities.copied'));
    } catch {
      showToast(t('opportunities.copyFailed'), 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={opportunitiesHomeHref(projectId)} className="text-xs text-muted hover:text-cream">
          {t('opportunities.back')}
        </Link>
        {projectLoading ? <p className="mt-2 text-sm text-muted">{t('project.loading')}</p> : null}
        {project?.name ? <p className="mt-2 text-sm text-muted">{project.name}</p> : null}
      </div>

      {projectError ? <p className="error-banner">{projectError}</p> : null}

      {error ? (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <button type="button" className="btn-ghost mt-2" onClick={() => setReloadToken((count) => count + 1)}>
            {t('ai.retry')}
          </button>
        </div>
      ) : null}

      {loading && !opportunity ? <p className="text-sm text-muted">{t('opportunities.loading')}</p> : null}

      {opportunity ? (
        <>
          <article className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="min-w-0 font-heading text-2xl">{opportunity.title || t('common.untitled')}</h1>
              {typeLabel && typeLabel !== '—' ? <span className="status-badge shrink-0">{typeLabel}</span> : null}
            </div>
            {opportunity.created_at ? (
              <p className="mt-2 text-xs text-muted">{formatTime(opportunity.created_at)}</p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={t('opportunities.topic')} value={textOrDash(opportunity.topic)} />
              <Field label={t('opportunities.audience')} value={textOrDash(opportunity.target_audience)} />
              <Field label={t('opportunities.pain')} value={textOrDash(opportunity.pain_point)} />
              <Field label={t('opportunities.hook')} value={textOrDash(opportunity.recommended_hook)} />
              <Field label={t('opportunities.angle')} value={textOrDash(opportunity.angle)} />
              <Field label={t('opportunities.structure')} value={structureLabel(opportunity.content_structure)} />
              <Field label={t('opportunities.platform')} value={textOrDash(opportunity.platform_suggestion)} />
            </div>
            <div className="mt-3">
              <Field label={t('opportunities.whyNow')} value={textOrDash(opportunity.why_now)} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{evidenceLine(opportunity.evidence)}</p>
            {opportunity.evidence?.total_views != null ? (
              <p className="mt-1 text-xs text-muted">
                {t('opportunities.totalViews', { count: formatInt(opportunity.evidence.total_views) })}
              </p>
            ) : null}
            <div className="mt-4">
              <Link href={criteriaHref(projectId, opportunity.evidence)} className="btn-ghost">
                {t('opportunities.similar')}
              </Link>
            </div>
          </article>

          <section>
            <h2 className="text-sm font-semibold">{t('opportunities.evidenceVideos')}</h2>
            {videos.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t('opportunities.noVideos')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {videos.map((video) => (
                  <VideoRow key={video.id} video={video} projectId={projectId} />
                ))}
              </ul>
            )}
          </section>

          <section id="brief" className="panel scroll-mt-20 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{t('opportunities.brief')}</h2>
              <button type="button" className="btn-primary" onClick={copyBrief}>
                {t('opportunities.copy')}
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words font-[inherit] text-sm leading-relaxed">{brief}</pre>
          </section>
        </>
      ) : null}
    </div>
  );
}
