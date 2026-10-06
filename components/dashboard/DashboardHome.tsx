'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProgressBar from '@/components/ProgressBar';
import ScraperNote from '@/components/ScraperNote';
import StatBox from '@/components/StatBox';
import { useProject } from '@/components/ProjectProvider';
import { api } from '@/lib/client/api';
import { formatTime, humanize, percentPoints, providerLabel, stepLabel } from '@/lib/client/format';
import { isOffTopic } from '@/lib/research/relevance';
import { t } from '@/lib/i18n';

interface RunRow {
  id: string;
  topic: string;
  status: string;
  current_step: string | null;
  progress: number;
  scraper_provider: string | null;
  scraper_note: string | null;
  created_at: string;
  completed_at: string | null;
}

interface InsightItem {
  label: string;
  count: number;
  percent: number;
}

interface VideoRow {
  analysis_status: string | null;
  is_high_potential: boolean | null;
  relevance?: number | null;
}

function statusClass(status: string): string {
  if (status === 'completed') return 'status-badge status-completed';
  if (status === 'failed') return 'status-badge status-failed';
  if (status === 'cancelled') return 'status-badge';
  return 'status-badge status-running';
}

function InsightPreview({ title, items }: { title: string; items: InsightItem[] }) {
  const rows = items.slice(0, 5);
  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{t('dashboard.nothingClustered')}</p> : null}
      <ul className="mt-3 space-y-3">
        {rows.map((item) => {
          const points = percentPoints(item.percent);
          return (
            <li key={item.label}>
              <div className="bar-row text-sm">
                <span className="truncate">{humanize(item.label)}</span>
                <span className="text-muted">{points}% · {item.count}</span>
              </div>
              <div className="thin-bar mt-1.5"><span style={{ width: `${points}%` }} /></div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function DashboardHome() {
  const { project, loading: projectLoading, error: projectError } = useProject();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [pain, setPain] = useState<InsightItem[]>([]);
  const [hooks, setHooks] = useState<InsightItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) {
      if (!projectLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api<{ runs: RunRow[] }>(`/api/research/runs?projectId=${encodeURIComponent(project.id)}`)
      .then(async (data) => {
        if (cancelled) return;
        const list = data.runs || [];
        setRuns(list);
        const completed = list.find((run) => run.status === 'completed');
        if (!completed) {
          setVideos([]);
          setPain([]);
          setHooks([]);
          return;
        }
        const [videoData, insightData] = await Promise.all([
          api<{ videos: VideoRow[] }>(`/api/research/runs/${completed.id}/videos?sort=viral&limit=100`),
          api<{ run: { insights: Record<string, InsightItem[]> | null } }>(`/api/research/runs/${completed.id}/insights`),
        ]);
        if (cancelled) return;
        setVideos(videoData.videos || []);
        const insights = insightData.run?.insights || {};
        setPain(insights.top_pain_points || []);
        setHooks(insights.top_hooks || []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || t('dashboard.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, projectLoading]);

  const completed = runs.find((run) => run.status === 'completed') || null;
  const analyzed = videos.filter((video) => video.analysis_status === 'complete').length;
  const highPotential = videos.filter((video) => video.is_high_potential && !isOffTopic(video.relevance)).length;
  const recent = runs.slice(0, 8);
  const projectQuery = project ? `project=${encodeURIComponent(project.id)}` : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-muted">{project?.name || t('project.choose')}</p>
        </div>
        <Link
          href={project ? `/research?${projectQuery}` : '/research'}
          className="btn-primary"
        >
          {t('dashboard.newResearch')}
        </Link>
      </div>

      {projectError || error ? <p className="error-banner">{projectError || error}</p> : null}
      {loading ? <p className="text-sm text-muted">{t('dashboard.loading')}</p> : null}

      {!loading && !error && runs.length === 0 ? (
        <section className="panel p-6">
          <h2 className="text-base font-semibold">{t('dashboard.emptyTitle')}</h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            {t('dashboard.emptyBody', { name: project?.name || t('dashboard.thisProject') })}
          </p>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox label={t('dashboard.stat.videos')} value={completed ? String(videos.length) : '—'} />
        <StatBox label={t('dashboard.stat.analyzed')} value={completed ? String(analyzed) : '—'} />
        <StatBox label={t('dashboard.stat.highPotential')} value={completed ? String(highPotential) : '—'} />
        <StatBox label={t('dashboard.stat.latestCompleted')} value={completed ? formatTime(completed.completed_at) : '—'} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t('dashboard.recentRuns')}</h2>
        {recent.length === 0 && !loading ? <p className="text-sm text-muted">{t('dashboard.recentEmpty')}</p> : null}
        <div className="space-y-2">
          {recent.map((run) => (
            <Link
              key={run.id}
              href={`/research?${projectQuery}&run=${encodeURIComponent(run.id)}`}
              className="panel block p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{run.topic}</span>
                <span className={statusClass(run.status)}>{stepLabel(run.status)}</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={run.progress} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>{stepLabel(run.current_step || run.status)} · {run.progress ?? 0}%</span>
                <span>{formatTime(run.created_at)}</span>
              </div>
              <p className="provider-label mt-2">{providerLabel(run.scraper_provider)}</p>
              <div className="mt-2">
                <ScraperNote note={run.scraper_note} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <InsightPreview title={t('dashboard.topPainPoints')} items={pain} />
        <InsightPreview title={t('dashboard.topHooks')} items={hooks} />
      </div>
    </div>
  );
}
