'use client';

import { useEffect, useState } from 'react';

interface RunRow {
  id: string;
  topic: string;
}

interface InsightItem {
  label: string;
  count: number;
  percent: number;
}

export default function InsightsHome() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runId, setRunId] = useState('');
  const [provider, setProvider] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [insights, setInsights] = useState<Record<string, InsightItem[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    fetch(`/api/research/runs/${runId}/insights`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load insights');
        setProvider(data.run?.scraper_provider || null);
        setNote(data.run?.scraper_note || null);
        setStatus(data.run?.status || '');
        setInsights(data.run?.insights || {});
      })
      .catch((err: Error) => setError(err.message));
  }, [runId]);

  async function generate() {
    if (!runId) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/research/runs/${runId}/ideas`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate ideas');
      window.location.href = `/insights?run=${runId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate ideas');
    } finally {
      setBusy(false);
    }
  }

  const sections: Array<[string, string]> = [
    ['top_pain_points', 'Pain points'],
    ['top_hooks', 'Hooks'],
    ['top_content_structures', 'Structures'],
    ['top_emotions', 'Emotions'],
    ['emerging_topics', 'Topics'],
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="font-heading text-[2rem] tracking-wide">Insights</h1>
      <label className="block max-w-md text-sm">
        <span className="mb-1 block text-muted">Run</span>
        <select value={runId} onChange={(event) => setRunId(event.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2" style={{ borderColor: 'var(--border)' }}>
          {runs.length === 0 ? <option value="">No runs</option> : null}
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.topic}</option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted">
        {status || 'no status'} · Provider: {provider || 'unknown'}{note ? ` · ${note}` : ''}
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {sections.map(([key, title]) => (
        <section key={key}>
          <h2 className="text-sm font-semibold">{title}</h2>
          {(insights[key] || []).length === 0 ? <p className="text-sm text-muted">None yet.</p> : null}
          <ul className="mt-1 space-y-1 text-sm">
            {(insights[key] || []).map((item) => (
              <li key={item.label}>{item.label} · {item.count} · {Math.round((item.percent || 0) * 100)}%</li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" onClick={generate} disabled={busy || !runId} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
        {busy ? 'Generating…' : 'Generate 10 ideas'}
      </button>
    </div>
  );
}
