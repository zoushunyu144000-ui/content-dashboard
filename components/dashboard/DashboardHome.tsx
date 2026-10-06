'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RunRow {
  id: string;
  topic: string;
  status: string;
  progress: number;
  scraper_provider: string | null;
  scraper_note: string | null;
}

export default function DashboardHome() {
  const [projects, setProjects] = useState(0);
  const [highPotential, setHighPotential] = useState(0);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load dashboard');
        setProjects(data.projects || 0);
        setHighPotential(data.high_potential || 0);
        setRuns(data.runs || []);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-heading text-[2rem] tracking-wide">Dashboard</h1>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs uppercase tracking-wider text-muted">Projects</div>
          <div className="mt-1 text-2xl">{projects}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs uppercase tracking-wider text-muted">High potential videos</div>
          <div className="mt-1 text-2xl">{highPotential}</div>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent runs</h2>
        {runs.length === 0 ? <p className="text-sm text-muted">No research runs yet.</p> : null}
        {runs.map((run) => (
          <Link key={run.id} href={`/research?run=${run.id}`} className="block rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">{run.topic}</span>
              <span className="text-muted">{run.status} · {run.progress}%</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              Provider {run.scraper_provider || 'pending'}
              {run.scraper_note ? ` · ${run.scraper_note}` : ''}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
