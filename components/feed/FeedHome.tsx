'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import FeedViewer, { type FeedVideo } from '@/components/FeedViewer';
import ScraperNote from '@/components/ScraperNote';
import { useProject } from '@/components/ProjectProvider';
import { api } from '@/lib/client/api';

interface RunRow {
  id: string;
  topic: string;
  status: string;
}

export default function FeedHome() {
  const router = useRouter();
  const pathname = usePathname();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const [runId, setRunId] = useState('');
  const [topic, setTopic] = useState('');
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [videoId, setVideoId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setVideoId(new URLSearchParams(window.location.search).get('video') || '');
  }, []);

  useEffect(() => {
    if (!project) {
      if (!projectLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setError('');
    api<{ runs: RunRow[] }>(`/api/research/runs?projectId=${encodeURIComponent(project.id)}`)
      .then((data) => {
        if (cancelled) return;
        const list = data.runs || [];
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('run') || '';
        const chosen = list.find((run) => run.id === requested) || list.find((run) => run.status === 'completed') || null;
        setRunId(chosen?.id || '');
        setTopic(chosen?.topic || '');
        if (!chosen) {
          setVideos([]);
          setProvider(null);
          setNote(null);
          setLoading(false);
          return;
        }
        if (requested !== chosen.id) {
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
    api<{ scraper_provider: string | null; scraper_note: string | null; videos: FeedVideo[] }>(
      `/api/research/runs/${runId}/videos?sort=viral&limit=100`,
    )
      .then((data) => {
        if (cancelled) return;
        setProvider(data.scraper_provider);
        setNote(data.scraper_note);
        setVideos(data.videos || []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load videos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div className="flex h-full flex-col">
      {projectError || error ? <p className="error-banner m-3 mt-14 md:mt-3">{projectError || error}</p> : null}
      {note ? (
        <div className="shrink-0 px-3 pb-2 pt-14 md:px-4 md:pt-3">
          <ScraperNote note={note} />
        </div>
      ) : null}
      {loading ? <p className="px-4 pt-16 text-sm text-muted">Loading the feed…</p> : null}
      {!loading && !error && !runId ? (
        <div className="px-4 pt-16">
          <h1 className="text-lg font-semibold">No completed research</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            Finish a run for {project?.name || 'this project'} and the feed will open on its videos.
          </p>
        </div>
      ) : null}
      {!loading && runId && videos.length === 0 && !error ? (
        <div className="px-4 pt-16">
          <h1 className="text-lg font-semibold">{topic || 'This run'}</h1>
          <p className="mt-2 text-sm text-muted">No videos were saved for this run.</p>
        </div>
      ) : null}
      {videos.length > 0 ? (
        <div className="min-h-0 flex-1">
          <FeedViewer videos={videos} provider={provider} initialVideoId={videoId} />
        </div>
      ) : null}
    </div>
  );
}
