'use client';

import { useEffect, useState } from 'react';

interface ProjectRow {
  id: string;
  name: string;
}

interface RunRow {
  id: string;
  topic: string;
  status: string;
  progress: number;
  error_message: string | null;
  scraper_provider: string | null;
  scraper_note: string | null;
}

export default function ResearchHome() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [projectId, setProjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [provider, setProvider] = useState('apify');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [projectRes, runRes] = await Promise.all([fetch('/api/projects'), fetch('/api/research/runs')]);
    const projectData = await projectRes.json();
    const runData = await runRes.json();
    if (!projectRes.ok) throw new Error(projectData.error || 'Could not load projects');
    if (!runRes.ok) throw new Error(runData.error || 'Could not load runs');
    const list = (projectData.projects || []) as ProjectRow[];
    setProjects(list);
    setProjectId((current) => current || list[0]?.id || '');
    setRuns(runData.runs || []);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/research/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, topic, scraperProvider: provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start a run');
      setTopic('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a run');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await fetch(`/api/research/runs/${id}/cancel`, { method: 'POST' });
    await load().catch((err: Error) => setError(err.message));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-heading text-[2rem] tracking-wide">Research</h1>
      <form onSubmit={onSubmit} className="grid gap-3 max-w-xl">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Project</span>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Topic</span>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border)' }} placeholder="web design for small businesses" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Scraper</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <option value="apify">Apify (default)</option>
            <option value="tikhub">TikHub</option>
            <option value="youtube">YouTube</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <button type="submit" disabled={busy || !projectId || !topic.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
          {busy ? 'Starting…' : 'Start research'}
        </button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="space-y-2">
        {runs.length === 0 ? <p className="text-sm text-muted">No runs yet.</p> : null}
        {runs.map((run) => (
          <article key={run.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{run.topic}</strong>
              <span className="text-muted">{run.status} · {run.progress}%</span>
            </div>
            <p className="mt-1 text-xs text-muted">Provider: {run.scraper_provider || 'not started'}</p>
            {run.scraper_note ? <p className="mt-1 text-xs text-muted">Note: {run.scraper_note}</p> : null}
            {run.error_message ? <p className="mt-1 text-xs text-red-400">{run.error_message}</p> : null}
            <div className="mt-2 flex gap-3 text-xs">
              <a href={`/feed?run=${run.id}`}>Feed</a>
              <a href={`/insights?run=${run.id}`}>Insights</a>
              {run.status !== 'completed' && run.status !== 'failed' && run.status !== 'cancelled' ? (
                <button type="button" onClick={() => cancel(run.id)} className="text-muted">Cancel</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
