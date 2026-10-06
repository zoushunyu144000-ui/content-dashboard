'use client';

import { useEffect, useState } from 'react';

interface RunRow {
  id: string;
  topic: string;
  scraper_provider: string | null;
  scraper_note: string | null;
}

interface VideoRow {
  id: string;
  caption: string | null;
  author_handle: string | null;
  views: number | null;
  viral_score: number | null;
  is_high_potential: boolean;
  embed_url: string | null;
  url: string | null;
  hook_type: string | null;
  pain_point: string | null;
}

export default function FeedHome() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runId, setRunId] = useState('');
  const [provider, setProvider] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('run') || '';
    fetch('/api/research/runs')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load runs');
        const list = (data.runs || []) as RunRow[];
        setRuns(list);
        setRunId(requested || list[0]?.id || '');
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/research/runs/${runId}/videos?sort=viral`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load videos');
        setProvider(data.scraper_provider);
        setNote(data.scraper_note);
        setVideos(data.videos || []);
      })
      .catch((err: Error) => setError(err.message));
  }, [runId]);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="font-heading text-[2rem] tracking-wide">Feed</h1>
      <label className="block max-w-md text-sm">
        <span className="mb-1 block text-muted">Run</span>
        <select value={runId} onChange={(event) => setRunId(event.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border)' }}>
          {runs.length === 0 ? <option value="">No runs</option> : null}
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.topic}</option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted">Provider: {provider || 'unknown'}{note ? ` · ${note}` : ''}</p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {runId && videos.length === 0 ? <p className="text-sm text-muted">No videos for this run yet.</p> : null}
      <div className="grid gap-3">
        {videos.map((video) => (
          <article key={video.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between gap-3">
              <span>{video.author_handle ? `@${video.author_handle}` : 'Unknown author'}</span>
              <span className="text-muted">Score {video.viral_score ?? '—'} · views {video.views ?? '—'}</span>
            </div>
            <p className="mt-2">{video.caption || 'No caption'}</p>
            <p className="mt-1 text-xs text-muted">
              {video.pain_point || 'no pain point'} · {video.hook_type || 'no hook'}
              {video.is_high_potential ? ' · high potential' : ''}
            </p>
            {video.url ? <a className="mt-2 inline-block text-xs" href={video.url} target="_blank" rel="noreferrer">Open video</a> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
