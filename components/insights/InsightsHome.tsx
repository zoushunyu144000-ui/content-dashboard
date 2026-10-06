'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import IdeaList, { type ContentIdea } from '@/components/IdeaList';
import InsightList, { type InsightExample, type InsightRow } from '@/components/InsightList';
import ScoreBadge from '@/components/ScoreBadge';
import ScraperNote from '@/components/ScraperNote';
import { useToast } from '@/components/ToastProvider';
import { useProject } from '@/components/ProjectProvider';
import { api } from '@/lib/client/api';
import { formatCount, formatTime, providerLabel } from '@/lib/client/format';
import { t } from '@/lib/i18n';

interface RunRow {
  id: string;
  topic: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface ClusterRow {
  id: string;
  kind: string;
  label: string;
  summary: string | null;
  video_count: number;
  percent: number | string;
}

interface PackedItem {
  label: string;
  count: number;
  percent: number;
  example_video_ids?: string[];
}

interface VideoRow extends InsightExample {
  views: number | null;
  viral_score: number | null;
  hook: string | null;
  analysis_status: string | null;
}

interface HighPotentialVideo {
  id: string;
  platform: string | null;
  url: string | null;
  thumbnail_url: string | null;
  author_handle: string | null;
  views: number | null;
  likes: number | null;
  viral_score: number | null;
  is_high_potential: boolean;
  hook: string | null;
}

const SECTIONS: Array<{ kind: string; key: string; titleKey: string }> = [
  { kind: 'pain_point', key: 'top_pain_points', titleKey: 'insights.section.painPoints' },
  { kind: 'hook', key: 'top_hooks', titleKey: 'insights.section.hooks' },
  { kind: 'structure', key: 'top_content_structures', titleKey: 'insights.section.structures' },
  { kind: 'emotion', key: 'top_emotions', titleKey: 'insights.section.emotions' },
  { kind: 'topic', key: 'emerging_topics', titleKey: 'insights.section.topics' },
];

export default function InsightsHome() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runId, setRunId] = useState('');
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [packed, setPacked] = useState<Record<string, PackedItem[]>>({});
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [highPotential, setHighPotential] = useState<HighPotentialVideo[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState<number | null>(null);
  const [onTopicCount, setOnTopicCount] = useState<number | null>(null);

  function writeRun(id: string) {
    setRunId(id);
    const params = new URLSearchParams(window.location.search);
    if (project?.id) params.set('project', project.id);
    if (id) params.set('run', id);
    else params.delete('run');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (!project) {
      if (!projectLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    api<{ runs: RunRow[] }>(`/api/research/runs?projectId=${encodeURIComponent(project.id)}`)
      .then((data) => {
        if (cancelled) return;
        const list = data.runs || [];
        setRuns(list);
        const requested = new URLSearchParams(window.location.search).get('run') || '';
        const chosen = list.find((run) => run.id === requested) || list.find((run) => run.status === 'completed') || list[0] || null;
        setRunId(chosen?.id || '');
        if (!chosen) setLoading(false);
        if (chosen && requested !== chosen.id) {
          const params = new URLSearchParams(window.location.search);
          params.set('project', project.id);
          params.set('run', chosen.id);
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || t('research.loadRunsError'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, project, projectLoading, router]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setAnalyzedCount(null);
    setOnTopicCount(null);
    setHighPotential([]);
    Promise.all([
      api<{
        run: { insights: Record<string, PackedItem[]> | null; scraper_provider: string | null; scraper_note: string | null; status: string };
        clusters: ClusterRow[];
        analyzed?: number;
        on_topic?: number;
        high_potential?: HighPotentialVideo[];
      }>(
        `/api/research/runs/${runId}/insights`,
      ),
      api<{ videos: VideoRow[]; scraper_provider: string | null; scraper_note: string | null }>(
        `/api/research/runs/${runId}/videos?sort=viral&limit=100`,
      ),
      api<{ ideas: ContentIdea[] }>(`/api/research/runs/${runId}/ideas`),
    ])
      .then(([insightData, videoData, ideaData]) => {
        if (cancelled) return;
        setClusters(insightData.clusters || []);
        setPacked(insightData.run?.insights || {});
        setProvider(insightData.run?.scraper_provider || videoData.scraper_provider);
        setNote(insightData.run?.scraper_note || videoData.scraper_note);
        setVideos(videoData.videos || []);
        setIdeas(ideaData.ideas || []);
        setAnalyzedCount(typeof insightData.analyzed === 'number' ? insightData.analyzed : null);
        setOnTopicCount(typeof insightData.on_topic === 'number' ? insightData.on_topic : null);
        setHighPotential(Array.isArray(insightData.high_potential) ? insightData.high_potential : []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || t('insights.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const selected = runs.find((run) => run.id === runId) || null;
  const analyzed = analyzedCount ?? videos.filter((video) => video.analysis_status === 'complete').length;

  const sections = useMemo(() => {
    return SECTIONS.map((section) => {
      const fromClusters = clusters.filter((cluster) => cluster.kind === section.kind);
      const fromPacked = packed[section.key] || [];
      const rows: InsightRow[] = fromClusters.length > 0
        ? fromClusters.map((cluster) => {
          const match = fromPacked.find((item) => item.label === cluster.label);
          const exampleIds = match?.example_video_ids || [];
          return {
            label: cluster.label,
            count: Number(cluster.video_count) || 0,
            percent: Number(cluster.percent) || 0,
            summary: cluster.summary,
            examples: exampleIds
              .map((id) => videos.find((video) => video.id === id))
              .filter((video): video is VideoRow => Boolean(video)),
          };
        })
        : fromPacked.map((item) => ({
          label: item.label,
          count: Number(item.count) || 0,
          percent: Number(item.percent) || 0,
          summary: null,
          examples: (item.example_video_ids || [])
            .map((id) => videos.find((video) => video.id === id))
            .filter((video): video is VideoRow => Boolean(video)),
        }));
      return { ...section, title: t(section.titleKey), rows };
    });
  }, [clusters, packed, videos]);

  async function generate() {
    if (!runId) return;
    setGenerating(true);
    try {
      const data = await api<{ ideas: ContentIdea[] }>(`/api/research/runs/${runId}/ideas`, { method: 'POST' });
      setIdeas(data.ideas || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('insights.generateError'), 'error');
    } finally {
      setGenerating(false);
    }
  }

  const projectId = project?.id || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">{t('insights.title')}</h1>
          <p className="mt-1 text-sm text-muted">{project?.name || t('project.choose')}</p>
          {selected && analyzedCount != null && onTopicCount != null ? (
            <p className="mt-1 text-sm">{t('insights.onTopic', { on: onTopicCount, analyzed: analyzedCount })}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted">{t('insights.aiLabelNote')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={generate} disabled={generating || !runId || selected?.status !== 'completed'}>
          {generating ? t('insights.generating') : t('insights.generate')}
        </button>
        {selected && selected.status !== 'completed' ? (
          <p className="w-full text-xs text-muted">{t('insights.ideasAfterComplete')}</p>
        ) : null}
      </div>

      {projectError || error ? <p className="error-banner">{projectError || error}</p> : null}

      <label className="block max-w-xl text-sm">
        <span className="mb-1 block text-muted">{t('insights.run')}</span>
        <select
          className="field"
          value={runId}
          onChange={(event) => writeRun(event.target.value)}
          disabled={runs.length === 0}
        >
          {runs.length === 0 ? <option value="">{t('insights.noRuns')}</option> : null}
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.topic}</option>
          ))}
        </select>
      </label>

      {!loading && runs.length === 0 ? (
        <section className="panel p-6">
          <h2 className="text-base font-semibold">{t('insights.emptyTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('insights.emptyBody')}</p>
        </section>
      ) : null}

      {selected ? (
        <section className="panel space-y-3 p-4">
          <h2 className="text-base font-semibold">{selected.topic}</h2>
          <p className="provider-label">{providerLabel(provider)}</p>
          <ScraperNote note={note} />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('insights.stat.videos')}</dt>
              <dd className="mt-1 font-mono">{videos.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('insights.stat.analyzed')}</dt>
              <dd className="mt-1 font-mono">{analyzed}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('insights.stat.finished')}</dt>
              <dd className="mt-1">{formatTime(selected.completed_at)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('insights.stat.started')}</dt>
              <dd className="mt-1">{formatTime(selected.created_at)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {loading ? <p className="text-sm text-muted">{t('insights.loading')}</p> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <InsightList
            key={section.key}
            title={section.title}
            items={section.rows}
            runId={runId}
            projectId={projectId}
          />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t('insights.highPotential')}</h2>
        {highPotential.length === 0 && !loading ? <p className="text-sm text-muted">{t('insights.highPotentialEmpty')}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {highPotential.map((video) => (
            <Link
              key={video.id}
              href={`/feed?project=${encodeURIComponent(projectId)}&run=${encodeURIComponent(runId)}&video=${encodeURIComponent(video.id)}`}
              className="panel flex gap-3 p-3"
            >
              {video.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnail_url} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
              ) : (
                <span className="block h-24 w-16 shrink-0 rounded" style={{ background: 'var(--surface)' }} />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{video.author_handle ? `@${video.author_handle}` : t('feed.unknownAuthor')}</span>
                <span className="mt-1 block text-xs text-muted">{t('insights.views')} {formatCount(video.views)} · {t('insights.likes')} {formatCount(video.likes)}</span>
                <span className="mt-2 block"><ScoreBadge score={video.viral_score} high={video.is_high_potential} /></span>
                <span className="mt-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>{video.hook || '—'}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t('insights.contentIdeas')}</h2>
        <IdeaList ideas={ideas} />
      </section>
    </div>
  );
}
