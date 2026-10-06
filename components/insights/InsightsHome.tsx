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
import { isOffTopic } from '@/lib/research/relevance';

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
  is_high_potential: boolean | null;
  hook: string | null;
  analysis_status: string | null;
  relevance?: number | null;
}

const SECTIONS: Array<{ kind: string; key: string; title: string }> = [
  { kind: 'pain_point', key: 'top_pain_points', title: 'Top Pain Points' },
  { kind: 'hook', key: 'top_hooks', title: 'Top Hooks' },
  { kind: 'structure', key: 'top_content_structures', title: 'Top Content Structures' },
  { kind: 'emotion', key: 'top_emotions', title: 'Top Emotions' },
  { kind: 'topic', key: 'emerging_topics', title: 'Emerging Topics' },
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
          setError(err.message || 'Could not load runs');
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
    Promise.all([
      api<{
        run: { insights: Record<string, PackedItem[]> | null; scraper_provider: string | null; scraper_note: string | null; status: string };
        clusters: ClusterRow[];
        analyzed?: number;
        on_topic?: number;
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
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load insights');
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
  const highPotential = videos.filter((video) => video.is_high_potential && !isOffTopic(video.relevance));

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
      return { ...section, rows };
    });
  }, [clusters, packed, videos]);

  async function generate() {
    if (!runId) return;
    setGenerating(true);
    try {
      const data = await api<{ ideas: ContentIdea[] }>(`/api/research/runs/${runId}/ideas`, { method: 'POST' });
      setIdeas(data.ideas || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not generate ideas', 'error');
    } finally {
      setGenerating(false);
    }
  }

  const projectId = project?.id || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">Insights</h1>
          <p className="mt-1 text-sm text-muted">{project?.name || 'Choose a project'}</p>
          {selected && analyzedCount != null && onTopicCount != null ? (
            <p className="mt-1 text-sm">{onTopicCount} of {analyzedCount} analyzed videos on-topic</p>
          ) : null}
        </div>
        <button type="button" className="btn-primary" onClick={generate} disabled={generating || !runId || selected?.status !== 'completed'}>
          {generating ? 'Generating…' : 'Generate Content Ideas'}
        </button>
        {selected && selected.status !== 'completed' ? (
          <p className="w-full text-xs text-muted">Ideas are available after the run completes.</p>
        ) : null}
      </div>

      {projectError || error ? <p className="error-banner">{projectError || error}</p> : null}

      <label className="block max-w-xl text-sm">
        <span className="mb-1 block text-muted">Run</span>
        <select
          className="field"
          value={runId}
          onChange={(event) => writeRun(event.target.value)}
          disabled={runs.length === 0}
        >
          {runs.length === 0 ? <option value="">No runs</option> : null}
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.topic}</option>
          ))}
        </select>
      </label>

      {!loading && runs.length === 0 ? (
        <section className="panel p-6">
          <h2 className="text-base font-semibold">Nothing to summarize</h2>
          <p className="mt-2 text-sm text-muted">Complete a research run and the six insight blocks will land here.</p>
        </section>
      ) : null}

      {selected ? (
        <section className="panel space-y-3 p-4">
          <h2 className="text-base font-semibold">{selected.topic}</h2>
          <p className="provider-label">{providerLabel(provider)}</p>
          <ScraperNote note={note} />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Videos</dt>
              <dd className="mt-1 font-mono">{videos.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Analyzed</dt>
              <dd className="mt-1 font-mono">{analyzed}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Finished</dt>
              <dd className="mt-1">{formatTime(selected.completed_at)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Started</dt>
              <dd className="mt-1">{formatTime(selected.created_at)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {loading ? <p className="text-sm text-muted">Loading insights…</p> : null}

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
        <h2 className="text-sm font-semibold">High Potential Videos</h2>
        {highPotential.length === 0 && !loading ? <p className="text-sm text-muted">No video in this run cleared the high-potential bar.</p> : null}
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
                <span className="block truncate text-sm font-medium">{video.author_handle ? `@${video.author_handle}` : 'Unknown author'}</span>
                <span className="mt-1 block text-xs text-muted">Views {formatCount(video.views)}</span>
                <span className="mt-2 block"><ScoreBadge score={video.viral_score} high /></span>
                <span className="mt-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>{video.hook || '—'}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Content ideas</h2>
        <IdeaList ideas={ideas} />
      </section>
    </div>
  );
}
