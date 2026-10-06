'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import ResearchProgress, { type ResearchEventView, type ResearchRunView } from '@/components/ResearchProgress';
import ScraperNote from '@/components/ScraperNote';
import { useProject } from '@/components/ProjectProvider';
import { api } from '@/lib/client/api';
import { formatTime, providerLabel, stepLabel } from '@/lib/client/format';

interface RunListItem {
  id: string;
  topic: string;
  status: string;
  current_step: string | null;
  progress: number;
  error_message: string | null;
  scraper_provider: string | null;
  scraper_note: string | null;
  created_at: string;
  completed_at: string | null;
}

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', enabled: true },
  { id: 'instagram', label: 'Instagram', enabled: false },
  { id: 'youtube', label: 'YouTube', enabled: false },
  { id: 'shorts', label: 'YouTube Shorts', enabled: false },
];

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

export default function ResearchHome() {
  const router = useRouter();
  const pathname = usePathname();
  const { project, projects, loading: projectLoading, error: projectError, setProjectId } = useProject();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runId, setRunId] = useState('');
  const [run, setRun] = useState<ResearchRunView | null>(null);
  const [events, setEvents] = useState<ResearchEventView[]>([]);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [pollKey, setPollKey] = useState(0);
  const [youtubeEnabled, setYoutubeEnabled] = useState(false);

  const selectRun = useCallback((id: string) => {
    setRunId(id);
    const params = new URLSearchParams(window.location.search);
    if (project?.id) params.set('project', project.id);
    if (id) params.set('run', id);
    else params.delete('run');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, project?.id, router]);

  useEffect(() => {
    if (!project) {
      if (!projectLoading) setLoadingRuns(false);
      return;
    }
    let cancelled = false;
    setLoadingRuns(true);
    api<{ runs: RunListItem[]; youtube_provider_enabled?: boolean }>(`/api/research/runs?projectId=${encodeURIComponent(project.id)}`)
      .then((data) => {
        if (cancelled) return;
        const list = data.runs || [];
        setRuns(list);
        setYoutubeEnabled(data.youtube_provider_enabled === true);
        const requested = new URLSearchParams(window.location.search).get('run') || '';
        setRunId(requested && list.some((item) => item.id === requested) ? requested : '');
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load runs');
      })
      .finally(() => {
        if (!cancelled) setLoadingRuns(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, projectLoading]);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setEvents([]);
      return;
    }
    let cancelled = false;
    let timer = 0;
    async function tick() {
      try {
        const data = await api<{ run: ResearchRunView; events: ResearchEventView[] }>(`/api/research/runs/${runId}`);
        if (cancelled) return;
        setRun(data.run);
        setEvents(data.events || []);
        setRuns((current) => current.map((item) => (
          item.id === data.run.id
            ? {
              ...item,
              status: data.run.status,
              current_step: data.run.current_step,
              progress: Number(data.run.progress) || 0,
              error_message: data.run.error_message,
              scraper_provider: data.run.scraper_provider,
              scraper_note: data.run.scraper_note,
              completed_at: data.run.completed_at || item.completed_at,
            }
            : item
        )));
        if (!TERMINAL.has(data.run.status)) timer = window.setTimeout(tick, 2500);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this run');
      }
    }
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [runId, pollKey]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !topic.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await api<{ id: string; status: string; existing?: boolean }>('/api/research/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, topic: topic.trim() }),
      });
      setTopic('');
      if (data.existing) setNotice('A research run is already in progress for this project.');
      const list = await api<{ runs: RunListItem[] }>(`/api/research/runs?projectId=${encodeURIComponent(project.id)}`);
      setRuns(list.runs || []);
      selectRun(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start research');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setError('');
    try {
      await api(`/api/research/runs/${id}/cancel`, { method: 'POST' });
      setPollKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the run');
    }
  }

  const projectQuery = project ? `project=${encodeURIComponent(project.id)}` : '';
  const platforms = PLATFORMS.map((item) => (
    item.id === 'shorts' && !youtubeEnabled
      ? { ...item, label: 'YouTube Shorts (unavailable on this server)', enabled: false, reason: '' }
      : { ...item, reason: item.enabled ? '' : 'coming soon' }
  ));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Research</h1>
        <p className="mt-1 text-sm text-muted">One topic. TikTok first. The pipeline falls back across scrapers on its own.</p>
      </div>

      {projectError || error ? <p className="error-banner">{projectError || error}</p> : null}
      {notice ? <p className="text-sm text-muted">{notice}</p> : null}

      <form onSubmit={onSubmit} className="panel grid gap-4 p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Project</span>
          <select
            value={project?.id || ''}
            onChange={(event) => setProjectId(event.target.value)}
            className="field"
            disabled={projectLoading || projects.length === 0}
          >
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Topic</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="field"
            placeholder="web design for small businesses"
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm text-muted">Platform</legend>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map((item) => (
              <label
                key={item.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${item.id === 'shorts' && !youtubeEnabled ? 'col-span-2' : ''} ${item.enabled ? '' : 'opacity-60'}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="platform"
                    value={item.id}
                    checked={item.enabled}
                    disabled={!item.enabled}
                    readOnly
                  />
                  {item.label}
                </span>
                {item.reason ? <span className="text-[11px] text-muted">{item.reason}</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary" disabled={busy || !project || !topic.trim()}>
          {busy ? 'Starting…' : 'Start'}
        </button>
      </form>

      {run ? <ResearchProgress run={run} events={events} /> : (
        <p className="text-sm text-muted">{loadingRuns ? 'Loading runs…' : 'Start a topic, or pick a run below, to watch the pipeline.'}</p>
      )}

      {run?.status === 'completed' && project ? (
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" href={`/feed?${projectQuery}&run=${encodeURIComponent(run.id)}`}>Open Feed</Link>
          <Link className="btn-ghost" href={`/insights?${projectQuery}&run=${encodeURIComponent(run.id)}`}>Open Insights</Link>
        </div>
      ) : null}

      {run && !TERMINAL.has(run.status) ? (
        <button type="button" className="btn-ghost" onClick={() => cancel(run.id)}>Cancel run</button>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">History</h2>
        {!loadingRuns && runs.length === 0 ? <p className="text-sm text-muted">No runs for this project yet.</p> : null}
        {runs.map((item) => (
          <article
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => selectRun(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectRun(item.id);
              }
            }}
            className="panel cursor-pointer p-3"
            style={item.id === runId ? { borderColor: 'var(--border-hover)' } : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{item.topic}</span>
              <span className="text-xs text-muted">{stepLabel(item.status)} · {item.progress ?? 0}%</span>
            </div>
            <p className="provider-label mt-1">{providerLabel(item.scraper_provider)} · {formatTime(item.created_at)}</p>
            <div className="mt-2"><ScraperNote note={item.scraper_note} /></div>
          </article>
        ))}
      </section>
    </div>
  );
}
