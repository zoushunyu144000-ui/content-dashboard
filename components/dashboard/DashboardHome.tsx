'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MetricPill from '@/components/MetricPill';
import ProjectReportDownload from '@/components/ProjectReportDownload';
import { useProject } from '@/components/ProjectProvider';
import ScoreBadge from '@/components/ScoreBadge';
import { authorLabel } from '@/components/library/shared';
import { api } from '@/lib/client/api';
import { percentPoints } from '@/lib/client/format';
import { t } from '@/lib/i18n';
import {
  formatInt,
  formatScore,
  hookLabel,
  libraryHref,
  opportunitiesHomeHref,
  opportunityHref,
  painLabel,
  topicLabel,
  type DashboardPayload,
  type RankItem,
  type ViralVideo,
} from '@/components/opportunities/shared';

function textDash(value: string | null | undefined): string {
  const trimmed = value?.trim() || '';
  return trimmed || '—';
}

function ranked(items: RankItem[] | null | undefined): Array<RankItem & { pct: number; count: number }> {
  const rows = (items || []).filter((item) => item && item.key);
  const sum = rows.reduce((acc, item) => acc + (Number(item.count) || 0), 0);
  return rows.map((item) => {
    const count = Number(item.count);
    const safeCount = Number.isFinite(count) ? count : 0;
    const raw = item.pct;
    const pct = raw == null || raw === '' || !Number.isFinite(Number(raw))
      ? (sum > 0 ? Math.round((safeCount / sum) * 100) : 0)
      : percentPoints(raw);
    return { ...item, count: safeCount, pct };
  });
}

function BarList({
  title,
  items,
  labelFor,
  hrefFor,
}: {
  title: string;
  items: Array<RankItem & { pct: number; count: number }>;
  labelFor: (key: string) => string;
  hrefFor: (key: string) => string;
}) {
  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted">{t('dashboard.emptyBars')}</p> : null}
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.key}>
            <Link href={hrefFor(item.key)} className="block rounded-md">
              <div className="bar-row text-sm">
                <span className="truncate">{labelFor(item.key)}</span>
                <span className="text-muted">{item.pct}% · {formatInt(item.count)}</span>
              </div>
              <div className="thin-bar mt-1.5"><span style={{ width: `${Math.max(0, Math.min(100, item.pct))}%` }} /></div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({
  label,
  title,
  meta,
  href,
}: {
  label: string;
  title: string;
  meta: string;
  href: string | null;
}) {
  const body = (
    <>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-2 text-base font-semibold leading-snug">{title}</p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </>
  );
  if (!href) return <div className="panel p-4">{body}</div>;
  return <Link href={href} className="panel block p-4 hover:bg-card-hover">{body}</Link>;
}

function ViralCard({ video, projectId }: { video: ViralVideo; projectId: string | undefined }) {
  const [broken, setBroken] = useState(false);
  const showThumb = Boolean(video.thumbnail_url) && !broken;
  const views = video.views == null || video.views === '' ? null : Number(video.views);
  const score = video.viral_score == null || video.viral_score === '' ? null : Number(video.viral_score);
  return (
    <Link href={libraryHref(projectId, {}, video.id)} className="panel flex h-full flex-col overflow-hidden p-0">
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
        <p className="truncate text-xs text-muted">{authorLabel(video.author_handle)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <MetricPill label={t('feed.views')} value={Number.isFinite(views) ? views : null} />
          <ScoreBadge score={Number.isFinite(score) ? score : null} />
        </div>
        {video.hook_type ? <span className="status-badge w-fit">{hookLabel(video.hook_type)}</span> : null}
      </div>
    </Link>
  );
}

export default function DashboardHome() {
  const { project, loading: projectLoading, error: projectError } = useProject();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const projectId = project?.id;

  useEffect(() => {
    if (!projectId) {
      if (!projectLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setLoading(true);
    setError('');
    api<DashboardPayload>(`/api/niches/${encodeURIComponent(projectId)}/dashboard`)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('dashboard.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoading, reloadToken]);

  const nicheName = data?.niche?.name || project?.name || t('dashboard.thisProject');
  const pain = data?.trending_pain_point?.key ? data.trending_pain_point : null;
  const hook = data?.best_hook?.key ? data.best_hook : null;
  const topic = data?.emerging_topic?.key ? data.emerging_topic : null;
  const recommended = data?.recommended?.id ? data.recommended : null;
  const pains = ranked(data?.top_pain_points);
  const hooks = ranked(data?.top_hooks);
  const topics = ranked(data?.top_topics);
  const recent = (data?.recent_viral || []).filter((video) => video && video.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">{t('dashboard.nextTitle')}</h1>
        <p className="mt-1 text-sm text-muted">
          {project?.name || (projectLoading ? t('project.loading') : t('project.choose'))}
        </p>
        <div className="mt-3">
          <ProjectReportDownload />
        </div>
      </div>

      {projectError || error ? (
        <div className="error-banner" role="alert">
          <p>{projectError || error}</p>
          {!projectError && error ? (
            <button type="button" className="btn-ghost mt-2" onClick={() => setReloadToken((count) => count + 1)}>
              {t('ai.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {projectLoading || (loading && !data && !error) ? <p className="text-sm text-muted">{t('dashboard.loading')}</p> : null}

      {!projectLoading && !project && !projectError ? <p className="text-sm text-muted">{t('project.none')}</p> : null}

      {project && data ? (
        <>
          <section className="panel p-4 sm:p-5">
            <h2 className="text-sm font-semibold">{t('dashboard.week', { name: nicheName })}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
              <div className="min-w-0">
                <div className="text-[11px] text-muted">{t('dashboard.week.discovered')}</div>
                <div className="mt-1 font-mono text-xl sm:text-2xl">{formatInt(data.week?.videos_discovered)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted">{t('dashboard.week.highPotential')}</div>
                <div className="mt-1 font-mono text-xl sm:text-2xl">{formatInt(data.week?.high_potential)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted">{t('dashboard.week.opportunities')}</div>
                <div className="mt-1 font-mono text-xl sm:text-2xl">{formatInt(data.week?.opportunities)}</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted">
              {t('dashboard.totals', {
                videos: formatInt(data.totals?.videos),
                analyzed: formatInt(data.totals?.analyzed),
              })}
            </p>
          </section>

          <div className="grid gap-3 md:grid-cols-3">
            <Tile
              label={t('dashboard.tile.pain')}
              title={pain ? painLabel(pain.key) : t('dashboard.tile.empty')}
              meta={pain ? `${formatInt(pain.count)} · ${pain.pct == null || pain.pct === '' ? '—' : `${percentPoints(pain.pct)}%`}` : '—'}
              href={pain ? libraryHref(projectId, { pain_point_category: pain.key }) : null}
            />
            <Tile
              label={t('dashboard.tile.hook')}
              title={hook ? hookLabel(hook.key) : t('dashboard.tile.empty')}
              meta={hook ? t('dashboard.tile.avgScore', { score: formatScore(hook.avg_viral_score) }) : '—'}
              href={hook ? libraryHref(projectId, { hook_type: hook.key }) : null}
            />
            <Tile
              label={t('dashboard.tile.topic')}
              title={topic ? topicLabel(topic.key) : t('dashboard.tile.empty')}
              meta={topic ? formatInt(topic.count) : '—'}
              href={topic ? libraryHref(projectId, { topic_category: topic.key }) : null}
            />
          </div>

          <section className="panel p-4 sm:p-5">
            <h2 className="text-sm font-semibold">{t('dashboard.recommended')}</h2>
            {recommended ? (
              <>
                <p className="mt-3 text-base font-semibold">{textDash(recommended.title)}</p>
                <p className="mt-2 text-sm"><span className="text-muted">{t('opportunities.hook')} </span>{textDash(recommended.recommended_hook)}</p>
                <p className="mt-2 text-sm"><span className="text-muted">{t('opportunities.whyNow')} </span>{textDash(recommended.why_now)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={opportunityHref(projectId, recommended.id)} className="btn-ghost">
                    {t('dashboard.viewEvidence')}
                  </Link>
                  <Link href={opportunityHref(projectId, recommended.id, 'brief')} className="btn-primary">
                    {t('dashboard.createContent')}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 max-w-lg text-sm text-muted">{t('dashboard.recommendedEmpty')}</p>
                <Link href={opportunitiesHomeHref(projectId)} className="btn-primary mt-4">
                  {t('dashboard.generateLink')}
                </Link>
              </>
            )}
          </section>

          <div className="grid gap-3 lg:grid-cols-3">
            <BarList
              title={t('dashboard.hotPain')}
              items={pains}
              labelFor={painLabel}
              hrefFor={(key) => libraryHref(projectId, { pain_point_category: key })}
            />
            <BarList
              title={t('dashboard.hotHooks')}
              items={hooks}
              labelFor={hookLabel}
              hrefFor={(key) => libraryHref(projectId, { hook_type: key })}
            />
            <BarList
              title={t('dashboard.hotTopics')}
              items={topics}
              labelFor={topicLabel}
              hrefFor={(key) => libraryHref(projectId, { topic_category: key })}
            />
          </div>

          <section>
            <h2 className="text-sm font-semibold">{t('dashboard.recentViral')}</h2>
            {recent.length === 0 ? <p className="mt-3 text-sm text-muted">{t('dashboard.recentViralEmpty')}</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {recent.map((video) => (
                <ViralCard key={video.id} video={video} projectId={projectId} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
